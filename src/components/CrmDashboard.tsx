import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { generatePalette, DEFAULT_PALETTE, type LandingPalette, type PaletteStyle } from '@/lib/colorPalette';
import { convertToWav } from '@/lib/audioWav';
import type { Session, PostgrestError } from '@supabase/supabase-js';
import {
  Users, TrendingUp, Search, Download, LogOut, Mail, Phone, MapPin,
  Bot, BarChart3, Calendar, ChevronLeft, ChevronRight, Loader2,
  ArrowUpRight, ArrowLeft, Clock, Filter, LayoutGrid, Table as TableIcon, X,
  Tag, PhoneCall, PhoneMissed, CheckCircle2, XCircle, UserCheck,
  Plus, StickyNote, Zap, Star, Trash2, AlertTriangle,
  Upload, FileText, CheckCircle2 as CheckIcon,
  Grid3X3 as DialpadIcon, Delete as DeleteIcon, PhoneOutgoing,
  Menu, SlidersHorizontal, ChevronDown, ChevronUp, Phone as PhoneIcon,
  DollarSign, Send, Settings as SettingsIcon, Save, PhoneOff,
  MessageCircle, Image as ImageIcon, Video as VideoIcon, Mic,
  FileText as FileIcon, Play, Paperclip, RefreshCw, Link2, Check, Bot as BotIcon, Pencil,
  Smile, X as XIcon, MoreVertical, CheckSquare, Square, Copy, FileText as FileTextIcon, Edit3, Eye,
  Camera,
  Bell, CalendarClock, BellRing, Shuffle, ClipboardList, History, Droplets, MessageSquare, RotateCcw,
  BookOpen, MousePointerClick, EyeOff, FileSpreadsheet,
  PanelLeft, Type, Signal, GitMerge, ShieldAlert, Activity,
  Building2, Trophy, Target, TrendingDown, GitBranch, Hash, Radar,

  LayoutTemplate, Inbox as InboxIcon,
  HelpCircle, Sun, Moon,
  CreditCard, Smartphone, ShieldBan,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import DashboardOverview from '@/components/DashboardOverview';
import TeamChatWidget from '@/components/TeamChatWidget';
import AnalyticsHub from '@/components/AnalyticsHub';
import MessageTemplates from '@/components/MessageTemplates';
import TemplatesHub from '@/components/TemplatesHub';
import WhatsAppBroadcast from '@/components/WhatsAppBroadcast';
import EmailBroadcast from '@/components/EmailBroadcast';
import TelegramBroadcast from '@/components/TelegramBroadcast';
import BroadcastHub from '@/components/BroadcastHub';
import InboxHub from '@/components/InboxHub';
import FollowUpsPage from '@/components/FollowUpsPage';
import TeamDashboardPanel from '@/components/TeamDashboardPanel';
import LeadDistributionPanel from '@/components/LeadDistributionPanel';
import AgentLeaderboard from '@/components/AgentLeaderboard';
import GoalTracking from '@/components/GoalTracking';
import WinLossAnalysis from '@/components/WinLossAnalysis';
import DuplicateDetectionView from '@/components/DuplicateDetectionView';
import LeadFollowupHeatmap from '@/components/LeadFollowupHeatmap';
import AutomationBuilder from '@/components/AutomationBuilder';
import BrokerTrackerPage from '@/components/BrokerTrackerPage';
import LeadTrackerPage from '@/components/LeadTrackerPage';
import LeadSourceBadge from '@/components/LeadSourceBadge';
import LeadWhatsAppDrawer from '@/components/LeadWhatsAppDrawer';
import WhatsAppChatbotBuilder from '@/components/WhatsAppChatbotBuilder';
import WhatsAppDripSequences from '@/components/WhatsAppDripSequences';
import WhatsAppOptOutManager from '@/components/WhatsAppOptOutManager';
import { SourceLogo } from '@/components/BrandLogos';
import WhatsAppOnboarding from '@/components/WhatsAppOnboarding';
import MetaAdsManager from '@/components/MetaAdsManager';
import BillingPlansSection from '@/components/BillingPlansSection';
import CheckoutDrawer from '@/components/CheckoutDrawer';

type LeadStatus = 'new' | 'called_no_response' | 'called_responded' | 'interested' | 'not_interested' | 'converted';

type Lead = {
  id: string;
  full_name: string;
  mobile_number: string;
  email: string;
  state: string;
  trading_product: 'algo' | 'tradingview_premium' | 'both';
  custom_data?: Record<string, unknown> | null;
  created_at: string;
  status: LeadStatus;
  tags: string[];
  notes: string;
  last_contacted_at: string | null;
  fund_amount: number | null;
  purchase_value?: number | null;
  meta_lead_id?: string | null;
  assigned_to?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  lead_score?: number;
  lead_source?: string | null;
  broker_id?: string | null;
  account_type?: 'new_account' | 'existing_account' | null;
  partner_code?: string | null;
};

const SOURCE_OPTIONS = ['Manual Entry', 'Meta Ads', 'Google Ads', 'YouTube Ads', 'Telegram Channel', 'WhatsApp Group', 'Landing Page', 'Popup Form', 'Bulk Upload'];

type SortKey = 'created_at' | 'full_name' | 'state' | 'trading_product' | 'status';
type SortDir = 'asc' | 'desc';
type ViewMode = 'table' | 'pipeline';
type MobileStatKey = 'total' | 'interested' | 'converted' | 'today' | 'funds' | 'setup';

const MOBILE_STAT_OPTIONS: { key: MobileStatKey; label: string }[] = [
  { key: 'total', label: 'Total Leads' },
  { key: 'interested', label: 'Interested' },
  { key: 'converted', label: 'Converted' },
  { key: 'today', label: 'New Today' },
  { key: 'funds', label: 'Total Funds' },
  { key: 'setup', label: 'Setup Cost' },
];

type DateFilterPreset = 'all' | 'today' | 'yesterday' | 'last_7_days' | 'this_week' | 'this_month' | 'this_year' | 'custom';
type ActiveView = 'dashboard' | 'leads' | 'inbox_hub' | 'inbox' | 'whatsapp' | 'settings' | 'drip' | 'analytics_hub' | 'email_analytics' | 'message_templates' | 'broadcast_hub' | 'broadcast' | 'email_broadcast' | 'telegram_broadcast' | 'activity_timeline' | 'revenue_forecast' | 'followups' | 'leaderboard' | 'goals' | 'win_loss' | 'duplicates' | 'heatmap' | 'automations' | 'brokers' | 'lead_tracker' | 'meta_ads' | 'wa_chatbot' | 'wa_drips' | 'wa_optout';

type UserRole = 'owner' | 'admin' | 'manager' | 'agent';

type TeamMember = {
  id: string;
  owner_id: string;
  email: string;
  role: 'admin' | 'manager' | 'agent';
  full_name: string | null;
  status: 'pending' | 'active' | 'disabled';
  created_at: string;
};

type PermissionFlags = { leads: boolean; inbox: boolean; export: boolean; deleteLeads: boolean; addLeads: boolean; bulkUpload: boolean; dialer: boolean; settings: boolean; teamManagement: boolean; analytics: boolean; broadcasts: boolean; followUps: boolean; automations: boolean };

const ROLE_PERMISSIONS: Record<UserRole, PermissionFlags> = {
  owner:    { leads: true, inbox: true, export: true, deleteLeads: true, addLeads: true, bulkUpload: true, dialer: true, settings: true, teamManagement: true, analytics: true, broadcasts: true, followUps: true, automations: true },
  admin:    { leads: true, inbox: true, export: true, deleteLeads: true, addLeads: true, bulkUpload: true, dialer: true, settings: true, teamManagement: false, analytics: true, broadcasts: true, followUps: true, automations: true },
  manager:  { leads: true, inbox: true, export: true, deleteLeads: false, addLeads: true, bulkUpload: true, dialer: true, settings: false, teamManagement: false, analytics: true, broadcasts: true, followUps: true, automations: false },
  agent:    { leads: true, inbox: false, export: false, deleteLeads: false, addLeads: false, bulkUpload: false, dialer: false, settings: false, teamManagement: false, analytics: false, broadcasts: false, followUps: false, automations: false },
};

type RolePermissionRow = {
  id: string;
  owner_id: string;
  role: 'admin' | 'manager' | 'agent';
  leads: boolean;
  inbox: boolean;
  export: boolean;
  delete_leads: boolean;
  add_leads: boolean;
  bulk_upload: boolean;
  dialer: boolean;
  settings: boolean;
  team_management: boolean;
  analytics: boolean;
  broadcasts: boolean;
  follow_ups: boolean;
  automations: boolean;
};

const PERMISSION_LABELS: { key: keyof PermissionFlags; label: string; desc: string; group?: string }[] = [
  { key: 'leads', label: 'View Leads', desc: 'Access the leads dashboard and lead list', group: 'Core' },
  { key: 'addLeads', label: 'Add Leads', desc: 'Create new leads manually', group: 'Core' },
  { key: 'inbox', label: 'Inbox Access', desc: 'View and reply to Telegram & WhatsApp conversations', group: 'Core' },
  { key: 'export', label: 'Export Leads', desc: 'Download leads as Excel or CSV', group: 'Core' },
  { key: 'deleteLeads', label: 'Delete Leads', desc: 'Permanently remove leads from the CRM', group: 'Core' },
  { key: 'bulkUpload', label: 'Bulk Upload', desc: 'Import multiple leads via Excel file', group: 'Core' },
  { key: 'dialer', label: 'Dialer', desc: 'Use the built-in phone dialer to call leads', group: 'Core' },
  { key: 'analytics', label: 'Analytics', desc: 'View email analytics, activity timeline, and revenue forecast', group: 'Features' },
  { key: 'broadcasts', label: 'Broadcasts', desc: 'Send WhatsApp, Telegram, and email broadcast campaigns', group: 'Features' },
  { key: 'followUps', label: 'Follow-Ups', desc: 'Create and manage lead follow-up reminders', group: 'Features' },
  { key: 'settings', label: 'Settings Access', desc: 'View and modify CRM settings', group: 'Admin' },
  { key: 'teamManagement', label: 'Team Management', desc: 'Invite and manage team members', group: 'Admin' },
];

function dbRowToPermissions(row: RolePermissionRow): PermissionFlags {
  return {
    leads: row.leads,
    inbox: row.inbox,
    export: row.export,
    deleteLeads: row.delete_leads,
    addLeads: row.add_leads,
    bulkUpload: row.bulk_upload,
    dialer: row.dialer,
    settings: row.settings,
    teamManagement: row.team_management,
    analytics: row.analytics ?? false,
    broadcasts: row.broadcasts ?? false,
    followUps: row.follow_ups ?? false,
    automations: row.automations ?? false,
  };
}

type ChatConversation = {
  id: string;
  telegram_chat_id: number;
  telegram_username: string | null;
  telegram_first_name: string | null;
  telegram_last_name: string | null;
  profile_pic_url: string | null;
  lead_id: string | null;
  last_message_text: string | null;
  last_message_at: string | null;
  unread_count: number;
  created_at: string;
  bot_id?: string | null;
  bot_label?: string | null;
};

type ChatMessage = {
  id: string;
  conversation_id: string;
  sender: 'client' | 'admin';
  message_type: 'text' | 'photo' | 'video' | 'audio' | 'voice' | 'document' | 'sticker' | 'animation' | 'location' | 'contact';
  text_content: string | null;
  file_id: string | null;
  file_unique_id: string | null;
  mime_type: string | null;
  file_size: number | null;
  file_name: string | null;
  media_width: number | null;
  media_height: number | null;
  media_duration: number | null;
  emoji: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
};

type WaConversation = {
  id: string;
  wa_phone_number: string;
  wa_name: string | null;
  wa_wa_id: string | null;
  profile_pic_url: string | null;
  lead_id: string | null;
  last_message_text: string | null;
  last_message_at: string | null;
  unread_count: number;
  created_at: string;
  wa_settings_id: string | null;
  is_typing?: boolean | null;
  typing_at?: string | null;
  labels?: string[] | null;
};

type ConvNote = {
  id: string;
  conversation_id: string;
  body: string;
  author_name: string | null;
  created_at: string;
};

type WaNumberConfig = {
  id: string;
  label: string;
  phone_number_id: string;
  access_token: string;
  verify_token: string;
  waba_id: string | null;
  welcome_message: string;
  connected_phone_number: string | null;
  meta_app_id: string | null;
  is_active: boolean;
  coex_enabled: boolean | null;
  created_at: string;
};

type WaTemplate = {
  id: string;
  meta_template_id: string | null;
  name: string;
  language: string;
  category: string;
  status: string;
  components: Record<string, unknown>[];
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
};

type WaMessage = {
  id: string;
  conversation_id: string;
  sender: 'client' | 'admin';
  message_type: 'text' | 'image' | 'video' | 'audio' | 'voice' | 'document' | 'sticker' | 'location' | 'contacts' | 'template';
  text_content: string | null;
  media_id: string | null;
  mime_type: string | null;
  file_size: number | null;
  file_name: string | null;
  media_width: number | null;
  media_height: number | null;
  media_duration: number | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
};

type FollowUp = {
  id: string;
  lead_id: string | null;
  title: string;
  note: string | null;
  reminder_at: string;
  status: 'pending' | 'sent' | 'snoozed' | 'done';
  email_sent_at: string | null;
  created_at: string;
};

type EmailTemplate = {
  id: string;
  user_id: string;
  name: string;
  subject: string;
  body: string;
  category: 'custom' | 'telegram_join' | 'follow_up' | 'welcome' | 'conversion';
  is_prebuilt: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ReplyTemplate = {
  id: string;
  title: string;
  body: string;
  channel: 'telegram' | 'whatsapp' | 'email' | 'all';
  category: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type LeadActivity = {
  id: string;
  lead_id: string | null;
  activity_type: string;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

type LeadNote = {
  id: string;
  lead_id: string;
  note: string;
  stage_at_time: string | null;
  created_at: string;
};

type DripCampaign = {
  id: string;
  name: string;
  description: string;
  channel: 'email' | 'telegram' | 'whatsapp';
  trigger_status: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type DripStep = {
  id: string;
  campaign_id: string;
  step_number: number;
  delay_hours: number;
  subject: string;
  body: string;
  created_at: string;
};

type DripEnrollment = {
  id: string;
  campaign_id: string;
  lead_id: string;
  enrolled_at: string;
  current_step: number;
  status: 'active' | 'completed' | 'paused' | 'unsubscribed';
  created_at: string;
};

export type PopupFormField = {
  id: string;
  type: 'text' | 'email' | 'tel' | 'select' | 'textarea' | 'number' | 'checkbox' | 'radio' | 'date' | 'url';
  label: string;
  placeholder: string;
  required: boolean;
  options: string[];
  mapsTo: 'full_name' | 'mobile_number' | 'email' | 'state' | 'trading_product' | 'fund_amount' | 'custom';
  default_value?: string;
  width?: 'full' | 'half';
};

export type PopupFormRow = {
  id: string;
  user_id: string;
  name: string;
  title: string;
  subtitle: string;
  fields: PopupFormField[];
  trigger_type: 'time_delay' | 'scroll' | 'exit_intent' | 'immediate';
  trigger_value: number;
  button_text: string;
  button_bg_color: string;
  button_text_color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  success_message?: string;
  show_once?: boolean;
  overlay_color?: string;
  popup_position?: 'center' | 'bottom_left' | 'bottom_right';
  auto_close_delay?: number;
  description?: string;
  image_url?: string;
};

const PAGE_SIZE = 10;

function getLastSeenStatus(lastMessageAt: string | null): { online: boolean; label: string } {
  if (!lastMessageAt) return { online: false, label: 'Offline' };
  const now = Date.now();
  const last = new Date(lastMessageAt).getTime();
  const diffMin = Math.floor((now - last) / 60000);
  if (diffMin < 2) return { online: true, label: 'Online' };
  if (diffMin < 60) return { online: false, label: `Last seen ${diffMin}m ago` };
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return { online: false, label: `Last seen ${diffHr}h ago` };
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return { online: false, label: `Last seen ${diffDay}d ago` };
  return { online: false, label: `Last seen ${new Date(lastMessageAt).toLocaleDateString()}` };
}

const DEFAULT_PIPELINE_STAGES: { key: LeadStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { key: 'new', label: 'New', icon: <Users size={15} />, color: 'blue' },
  { key: 'called_no_response', label: 'Called - No Response', icon: <PhoneMissed size={15} />, color: 'orange' },
  { key: 'called_responded', label: 'Called - Responded', icon: <PhoneCall size={15} />, color: 'cyan' },
  { key: 'interested', label: 'Interested', icon: <Star size={15} />, color: 'green' },
  { key: 'not_interested', label: 'Not Interested', icon: <XCircle size={15} />, color: 'red' },
  { key: 'converted', label: 'Converted', icon: <CheckCircle2 size={15} />, color: 'gold' },
];

const STAGE_COLORS: Record<string, { bg: string; border: string; text: string; dot: string; cardBg: string }> = {
  blue: { bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)', text: '#2563EB', dot: '#3B82F6', cardBg: 'rgba(59,130,246,0.06)' },
  orange: { bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.3)', text: '#EA580C', dot: '#F97316', cardBg: 'rgba(249,115,22,0.06)' },
  cyan: { bg: 'rgba(6,182,212,0.1)', border: 'rgba(6,182,212,0.3)', text: '#0891B2', dot: '#06B6D4', cardBg: 'rgba(6,182,212,0.06)' },
  green: { bg: 'rgba(22,163,74,0.1)', border: 'rgba(22,163,74,0.3)', text: '#15803D', dot: '#22C55E', cardBg: 'rgba(22,163,74,0.06)' },
  red: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', text: '#DC2626', dot: '#EF4444', cardBg: 'rgba(239,68,68,0.06)' },
  gold: { bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.35)', text: '#854D0E', dot: '#EAB308', cardBg: 'rgba(234,179,8,0.08)' },
};

const SUGGESTED_TAGS = ['Hot Lead', 'Cold Lead', 'Callback', 'WhatsApp Sent', 'Follow Up', 'Demo Scheduled', 'High Budget', 'Beginner'];

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

type NewLeadForm = {
  full_name: string;
  mobile_number: string;
  email: string;
  state: string;
  trading_product: 'algo' | 'tradingview_premium' | 'both';
  service_interest: 'indicator' | 'algo' | 'both';
  referral_readiness: 'yes' | 'need_more_information' | 'no';
  funding_readiness: 'now' | 'after_demo' | 'not_at_moment';
  status: LeadStatus;
  notes: string;
  fund_amount: number | null;
  lead_source: string;
};

const DEFAULT_STAGE_EVENTS: Record<LeadStatus, string> = {
  new: 'Lead',
  not_interested: 'Lead',
  called_no_response: 'Contact',
  called_responded: 'Contact',
  interested: 'Contact',
  converted: 'Purchase',
};

const META_EVENT_OPTIONS = ['Lead', 'Contact', 'Purchase', 'AddToCart', 'InitiateCheckout', 'Subscribe', 'CompleteRegistration', 'Custom'] as const;

async function sendMetaConversionEvent(leadId: string, lead: Lead, newStatus: LeadStatus) {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return;

    // Fetch the user's custom event mapping from DB
    const { data: metaSettings } = await supabase
      .from('meta_conversion_settings')
      .select('event_new, event_called_no_response, event_called_responded, event_interested, event_not_interested, event_converted')
      .maybeSingle();

    const stageKey = `event_${newStatus}` as keyof typeof DEFAULT_STAGE_EVENTS;
    const eventName = (metaSettings?.[stageKey as string] as string) || DEFAULT_STAGE_EVENTS[newStatus];
    if (!eventName || eventName === 'None') return;

    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-conversion-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        lead_id: leadId,
        event_name: eventName,
        status: newStatus,
        fund_amount: lead.fund_amount,
        purchase_value: lead.purchase_value ?? null,
        mobile_number: lead.mobile_number,
        email: lead.email,
        meta_lead_id: lead.meta_lead_id || null,
        fbc: typeof document !== 'undefined' ? (document.cookie.match(/_fbc=([^;]+)/)?.[1] || null) : null,
        fbp: typeof document !== 'undefined' ? (document.cookie.match(/_fbp=([^;]+)/)?.[1] || null) : null,
        event_source_url: typeof window !== 'undefined' ? window.location.href : undefined,
      }),
    });
  } catch {
    // Silent fail — conversion events should not block CRM usage
  }
}

const VALID_VIEWS: ActiveView[] = ['dashboard', 'leads', 'inbox_hub', 'inbox', 'whatsapp', 'settings', 'drip', 'analytics_hub', 'email_analytics', 'message_templates', 'broadcast_hub', 'broadcast', 'email_broadcast', 'telegram_broadcast', 'activity_timeline', 'revenue_forecast', 'followups', 'leaderboard', 'goals', 'win_loss', 'duplicates', 'heatmap', 'automations', 'brokers', 'lead_tracker', 'meta_ads', 'wa_chatbot', 'wa_drips', 'wa_optout'];

export default function CrmDashboard({ session, initialView }: { session: Session; initialView?: string }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [productFilter, setProductFilter] = useState<'all' | 'algo' | 'tradingview_premium'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | LeadStatus>('all');
  const [dupesOnly, setDupesOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showAddLead, setShowAddLead] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [trashedLeads, setTrashedLeads] = useState<Lead[]>([]);
  const [showTrashModal, setShowTrashModal] = useState(false);
  const [emptyingTrash, setEmptyingTrash] = useState(false);
  const [restoringAll, setRestoringAll] = useState(false);
  const [showFilterDeleteModal, setShowFilterDeleteModal] = useState(false);
  const [filterDeleting, setFilterDeleting] = useState(false);
  const [filterDeleteStatus, setFilterDeleteStatus] = useState<string>('not_interested');
  const [filterDeleteProduct, setFilterDeleteProduct] = useState<string>('all');
  const [filterDeleteDays, setFilterDeleteDays] = useState<number>(90);
  const [filterDeleteResult, setFilterDeleteResult] = useState<number | null>(null);
  const [showDialer, setShowDialer] = useState(false);
  const [dialerNumber, setDialerNumber] = useState('');
  const [dialerCallInitiated, setDialerCallInitiated] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilterPreset>('all');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('crm-sidebar-collapsed') === 'true'; } catch { return false; }
  }, []);

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try { return localStorage.getItem('crm-dark-mode') === 'true'; } catch { return false; }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('crm-dark', darkMode);
    try { localStorage.setItem('crm-dark-mode', String(darkMode)); } catch { /* ignore */ }
  }, [darkMode]);

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState<'leads' | 'pipeline'>('leads');
  const [mobileCustomizeOpen, setMobileCustomizeOpen] = useState(false);
  const [hiddenMobileStats, setHiddenMobileStats] = useState<MobileStatKey[]>(() => {
    try {
      const saved = localStorage.getItem(`crm-mobile-stats-${session.user.id}`);
      if (!saved) return [];
      const parsed: unknown = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((key): key is MobileStatKey => MOBILE_STAT_OPTIONS.some((option) => option.key === key));
    } catch {
      return [];
    }
  });
  const [emailTarget, setEmailTarget] = useState<Lead | null>(null);
  const [showBulkEmail, setShowBulkEmail] = useState(false);
  const [showBulkWa, setShowBulkWa] = useState(false);
  const [bulkWaTplName, setBulkWaTplName] = useState('');
  const [bulkWaTplLanguage, setBulkWaTplLanguage] = useState('en_US');
  const [bulkWaTplComponents, setBulkWaTplComponents] = useState<Record<string, unknown>[]>([]);
  const [bulkWaSending, setBulkWaSending] = useState(false);
  const [bulkWaResult, setBulkWaResult] = useState<{ sent: number; failed: number; total: number } | null>(null);
  const [bulkWaError, setBulkWaError] = useState('');
  const [bulkWaTemplates, setBulkWaTemplates] = useState<WaTemplate[]>([]);
  const [bulkWaTemplatesLoading, setBulkWaTemplatesLoading] = useState(false);
  const [showBulkStatus, setShowBulkStatus] = useState(false);
  const [bulkStatusValue, setBulkStatusValue] = useState<LeadStatus>('interested');
  const [bulkStatusUpdating, setBulkStatusUpdating] = useState(false);
  const [bulkStatusResult, setBulkStatusResult] = useState<number | null>(null);
  const [showBulkFund, setShowBulkFund] = useState(false);
  const [bulkFundValue, setBulkFundValue] = useState('');
  const [bulkFundUpdating, setBulkFundUpdating] = useState(false);
  const [bulkFundResult, setBulkFundResult] = useState<number | null>(null);
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [bulkAssignValue, setBulkAssignValue] = useState('');
  const [bulkAssignUpdating, setBulkAssignUpdating] = useState(false);
  const [bulkAssignResult, setBulkAssignResult] = useState<number | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>(() => {
    if (initialView && VALID_VIEWS.includes(initialView as ActiveView)) return initialView as ActiveView;
    return 'dashboard';
  });

  const navigateToView = (view: ActiveView) => {
    setActiveView(view);
    const basePath = window.location.hash.replace(/^#\/?[^/]*\/?.*$/, (m) => m.split('/')[0] || 'admin');
    const currentPath = window.location.hash.slice(1);
    const prefix = currentPath.startsWith('/') ? '/' : '';
    const routeRoot = currentPath.replace(/^\/?[^/]+\/?.*$/, (m) => m.split('/')[0]) || 'admin';
    const newHash = `#${prefix}${routeRoot}/${view}`;
    if (window.location.hash !== newHash) {
      window.location.hash = newHash;
    }
  };

  useEffect(() => {
    const onHashChange = () => {
      const currentPath = window.location.hash.slice(1);
      const match = currentPath.replace(/^\/?[^/]+\//, '');
      if (match && VALID_VIEWS.includes(match as ActiveView)) {
        setActiveView(match as ActiveView);
      } else if (!match || !currentPath.includes('/')) {
        setActiveView('dashboard');
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  const [unreadCount, setUnreadCount] = useState(0);
  const [waUnreadCount, setWaUnreadCount] = useState(0);
  const [emailUnreadCount, setEmailUnreadCount] = useState(0);
  const [showTelegramInbox, setShowTelegramInbox] = useState(true);
  const [showWhatsAppInbox, setShowWhatsAppInbox] = useState(true);

  const [sectionVisibility, setSectionVisibility] = useState<Record<string, boolean>>({
    leads: true, brokers: true, inbox: true, broadcasts: true,
    analytics: true, lead_tracker: true, templates: true, followups: true,
    automations: true, pipeline: true,
  });
  const [sidebarSections, setSidebarSections] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('crm-sidebar-sections');
      if (saved) return JSON.parse(saved) as Record<string, boolean>;
    } catch { /* ignore */ }
    return { main: true, inbox: true, campaigns: true, analytics: true, tools: true, pipeline: true };
  });
  const updateSidebarSection = (key: string, visible: boolean) => {
    setSidebarSections((prev) => {
      const next = { ...prev, [key]: visible };
      try { localStorage.setItem('crm-sidebar-sections', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };
  const [setupCostPerClient, setSetupCostPerClient] = useState(10);
  const [inboxRefreshKey, setInboxRefreshKey] = useState(0);
  const [waRefreshKey, setWaRefreshKey] = useState(0);
  const [userRole, setUserRole] = useState<UserRole>('owner');
  const [roleLoading, setRoleLoading] = useState(true);
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);
  const [viewMode2, setViewMode2] = useState<'my' | 'all'>('my');
  const [customPermissions, setCustomPermissions] = useState<Record<string, PermissionFlags>>({});
  const [dashFollowups, setDashFollowups] = useState<FollowUp[]>([]);
  const [assigneeMap, setAssigneeMap] = useState<Record<string, string>>({});
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<Lead | null>(null);
  const [waDrawerLead, setWaDrawerLead] = useState<Lead | null>(null);
  const [showBulkMerge, setShowBulkMerge] = useState(false);
  const [incomingCall, setIncomingCall] = useState<{ callId: string; phoneNumber: string; sdpOffer: string } | null>(null);
  const [activeCall, setActiveCall] = useState<{ callId: string; phoneNumber: string } | null>(null);
  const [pipelineAutoAssignEnabled, setPipelineAutoAssignEnabled] = useState<boolean>(true);
  const [pipelineAutoAssignStages, setPipelineAutoAssignStages] = useState<string[]>(['called_no_response','called_responded','interested','not_interested','converted']);
  const [autoAssignToast, setAutoAssignToast] = useState<{ leadName: string; assigneeName: string } | null>(null);
  const [stageLabelMap, setStageLabelMap] = useState<Record<string, string>>({});

  useEffect(() => {
    localStorage.setItem(`crm-mobile-stats-${session.user.id}`, JSON.stringify(hiddenMobileStats));
  }, [hiddenMobileStats, session.user.id]);

  const toggleMobileStat = (key: MobileStatKey) => {
    setHiddenMobileStats((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  };
  useEffect(() => {
    try { localStorage.setItem('crm-sidebar-collapsed', String(sidebarCollapsed)); } catch { /* ignore */ }
  }, [sidebarCollapsed]);

  const toggleSidebar = () => setSidebarCollapsed((prev) => !prev);

  const [callConnecting, setCallConnecting] = useState(false);
  const incomingPcRef = useRef<RTCPeerConnection | null>(null);

  // Subscribe to incoming WhatsApp calls via realtime
  useEffect(() => {
    const channel = supabase
      .channel('wa-incoming-calls')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'wa_call_sessions' },
        (payload: { new: Record<string, unknown> }) => {
          const row = payload.new;
          if (row.status === 'incoming_ringing' && row.direction === 'user_initiated' && row.call_id && row.sdp_offer) {
            setIncomingCall({
              callId: row.call_id as string,
              phoneNumber: row.phone_number as string,
              sdpOffer: row.sdp_offer as string,
            });
          }
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'wa_call_sessions' },
        (payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => {
          const row = payload.new;
          if (row.status === 'ended' || row.status === 'failed' || row.status === 'rejected') {
            const endedCallId = row.call_id as string;
            setActiveCall((prev) => {
              if (prev && prev.callId === endedCallId) return null;
              return prev;
            });
            setIncomingCall((prev) => {
              if (prev && prev.callId === endedCallId) return null;
              return prev;
            });
            setCallConnecting(false);
            if (incomingPcRef.current) { incomingPcRef.current.close(); incomingPcRef.current = null; }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Play ringing tone while an incoming call is active
  useEffect(() => {
    if (!incomingCall) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    let stopped = false;
    let timeoutId: number | undefined;

    const playRing = () => {
      if (stopped) return;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.frequency.value = 440;
      osc2.frequency.value = 480;
      osc1.type = 'sine';
      osc2.type = 'sine';
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 1.6);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 2.0);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 2.0);
      osc2.stop(ctx.currentTime + 2.0);
      timeoutId = window.setTimeout(playRing, 4000);
    };
    playRing();

    return () => {
      stopped = true;
      if (timeoutId) clearTimeout(timeoutId);
      ctx.close().catch(() => {});
    };
  }, [incomingCall]);

  const acceptIncomingCall = async () => {
    if (!incomingCall) return;
    setCallConnecting(true);
    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      incomingPcRef.current = pc;

      const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

      pc.ontrack = (event) => {
        const remoteAudio = new Audio();
        remoteAudio.srcObject = event.streams[0];
        remoteAudio.autoplay = true;
      };
      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'closed') {
          setActiveCall(null);
          setCallConnecting(false);
          if (incomingPcRef.current) { incomingPcRef.current.close(); incomingPcRef.current = null; }
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: incomingCall.sdpOffer }));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') { resolve(); return; }
        const checkState = () => { if (pc.iceGatheringState === 'complete') { pc.removeEventListener('icegatheringstatechange', checkState); resolve(); } };
        pc.addEventListener('icegatheringstatechange', checkState);
        setTimeout(resolve, 3000);
      });

      const sdpAnswer = pc.localDescription?.sdp || '';

      // Step 1: Pre-accept to establish WebRTC connection
      const preRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-call`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pre_accept', callId: incomingCall.callId, sdpAnswer }),
      });
      const preData = await preRes.json();
      if (!preRes.ok || preData.error) {
        throw new Error(preData.error || 'Failed to pre-accept call');
      }

      // Step 2: Accept to finalize the call
      const accRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-call`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept', callId: incomingCall.callId, sdpAnswer }),
      });
      const accData = await accRes.json();
      if (!accRes.ok || accData.error) {
        throw new Error(accData.error || 'Failed to accept call');
      }

      setActiveCall({ callId: incomingCall.callId, phoneNumber: incomingCall.phoneNumber });
      setIncomingCall(null);
      setCallConnecting(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to accept call';
      console.error('Incoming call error:', msg);
      setIncomingCall(null);
      setCallConnecting(false);
      if (incomingPcRef.current) { incomingPcRef.current.close(); incomingPcRef.current = null; }
    }
  };

  const rejectIncomingCall = async () => {
    if (!incomingCall) return;
    try {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-call`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', callId: incomingCall.callId }),
      });
    } catch { /* best effort */ }
    setIncomingCall(null);
  };

  const endActiveCall = async () => {
    if (!activeCall) return;
    try {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-call`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'terminate', callId: activeCall.callId }),
      });
    } catch { /* best effort */ }
    setActiveCall(null);
    if (incomingPcRef.current) { incomingPcRef.current.close(); incomingPcRef.current = null; }
  };

  useEffect(() => {
    (async () => {
      // Look for a team member record
      const { data } = await supabase
        .from('team_members')
        .select('id, role, status')
        .eq('email', session.user.email || '')
        .maybeSingle();
      if (data && data.status === 'active') {
        setUserRole(data.role as UserRole);
        setCurrentMemberId(data.id);
      } else {
        // No team member — treat as owner
        setUserRole('owner');
        const { data: ownerMember } = await supabase
          .from('team_members')
          .select('id, role, status')
          .eq('email', session.user.email || '')
          .eq('owner_id', session.user.id)
          .maybeSingle();
        if (ownerMember && ownerMember.status === 'active') {
          setCurrentMemberId(ownerMember.id);
        } else {
          setCurrentMemberId(null);
        }
      }
      setRoleLoading(false);

      // Load custom role permissions
      const { data: permData } = await supabase
        .from('role_permissions')
        .select('*');
      if (permData) {
        const map: Record<string, PermissionFlags> = {};
        for (const row of permData as RolePermissionRow[]) {
          map[row.role] = dbRowToPermissions(row);
        }
        setCustomPermissions(map);
      } else {
        setCustomPermissions({});
      }
    })();
  }, [session.user.email]);

  // Presence heartbeat: update last_seen_at on mount and every 2 minutes
  useEffect(() => {
    let cancelled = false;
    const heartbeat = async (isLogin: boolean) => {
      if (cancelled) return;
      try {
        await supabase.rpc('update_my_presence', { p_last_login: isLogin });
      } catch { /* ignore heartbeat errors */ }
    };
    heartbeat(true);
    const interval = setInterval(() => heartbeat(false), 120000);
    const onVisibility = () => { if (document.visibilityState === 'visible') heartbeat(false); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // Load pipeline auto-assign settings on mount
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('pipeline_autoassign_settings')
        .select('enabled, assign_on_stages')
        .maybeSingle();
      if (data) {
        const s = data as { enabled: boolean; assign_on_stages: string[] };
        setPipelineAutoAssignEnabled(s.enabled);
        setPipelineAutoAssignStages(s.assign_on_stages || ['called_no_response','called_responded','interested','not_interested','converted']);
      }
    })();
  }, []);

  // Load appearance settings on CRM mount
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('appearance_settings')
        .select('show_telegram_inbox, show_whatsapp_inbox, show_leads, show_brokers, show_inbox, show_broadcasts, show_analytics, show_lead_tracker, show_templates, show_followups, show_automations, show_pipeline, setup_cost')
        .maybeSingle();
      if (data) {
        const a = data as { show_telegram_inbox: boolean; show_whatsapp_inbox: boolean; show_leads: boolean; show_brokers: boolean; show_inbox: boolean; show_broadcasts: boolean; show_analytics: boolean; show_lead_tracker: boolean; show_templates: boolean; show_followups: boolean; show_automations: boolean; show_pipeline: boolean; setup_cost: number | null };
        setShowTelegramInbox(a.show_telegram_inbox !== false);
        setShowWhatsAppInbox(a.show_whatsapp_inbox !== false);
        setSectionVisibility({
          leads: a.show_leads !== false,
          brokers: a.show_brokers !== false,
          inbox: a.show_inbox !== false,
          broadcasts: a.show_broadcasts !== false,
          analytics: a.show_analytics !== false,
          lead_tracker: a.show_lead_tracker !== false,
          templates: a.show_templates !== false,
          followups: a.show_followups !== false,
          automations: a.show_automations !== false,
          pipeline: a.show_pipeline !== false,
        });
        if (a.setup_cost != null) setSetupCostPerClient(a.setup_cost);
      }
    })();
  }, []);

  // Load custom pipeline stage labels on mount
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('pipeline_stage_labels')
        .select('stage_key, label');
      if (data) {
        const map: Record<string, string> = {};
        for (const row of data as { stage_key: string; label: string }[]) {
          map[row.stage_key] = row.label;
        }
        setStageLabelMap(map);
      }
    })();
  }, []);

  const pipelineStages = useMemo(() =>
    DEFAULT_PIPELINE_STAGES.map((s) => ({
      ...s,
      label: stageLabelMap[s.key] ?? s.label,
    })),
  [stageLabelMap]);

  const permissions = customPermissions[userRole] || ROLE_PERMISSIONS[userRole];

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: fetchError } = await supabase
      .from('submissions')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }
    const rawLeads = (data || []) as Lead[];
    const scoredLeads = rawLeads.map((l) => {
      let score = 0;
      if (l.status === 'interested') score += 40;
      else if (l.status === 'called_responded') score += 25;
      else if (l.status === 'called_no_response') score += 10;
      else if (l.status === 'converted') score += 50;
      else if (l.status === 'not_interested') score -= 20;
      if (l.fund_amount && l.fund_amount > 0) score += Math.min(20, Math.floor(l.fund_amount / 50000));
      if (l.tags && l.tags.length > 0) score += l.tags.length * 3;
      if (l.notes && l.notes.trim().length > 0) score += 5;
      if (l.last_contacted_at) {
        const daysSince = (Date.now() - new Date(l.last_contacted_at).getTime()) / 86400000;
        if (daysSince < 3) score += 10;
        else if (daysSince < 7) score += 5;
      }
      score = Math.max(0, Math.min(100, score));
      return { ...l, lead_score: score };
    });
    setLeads(scoredLeads);
    setLoading(false);
  }, []);

  const fetchTrashedLeads = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('submissions')
      .select('*')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });
    if (fetchError) {
      setError(fetchError.message);
      return;
    }
    setTrashedLeads((data || []) as Lead[]);
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const fetchBulkWaTemplates = useCallback(async () => {
    setBulkWaTemplatesLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { setBulkWaTemplatesLoading(false); return; }
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-templates?action=list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.templates) {
        setBulkWaTemplates(data.templates.filter((t: WaTemplate) => t.status === 'APPROVED'));
      } else {
        const { data: dbData } = await supabase.from('wa_message_templates').select('*').order('created_at', { ascending: false });
        setBulkWaTemplates((dbData || []).filter((t: WaTemplate) => t.status === 'APPROVED'));
      }
    } catch {
      try {
        const { data: dbData } = await supabase.from('wa_message_templates').select('*').order('created_at', { ascending: false });
        setBulkWaTemplates((dbData || []).filter((t: WaTemplate) => t.status === 'APPROVED'));
      } catch { /* ignore */ }
    } finally {
      setBulkWaTemplatesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showBulkWa) fetchBulkWaTemplates();
  }, [showBulkWa, fetchBulkWaTemplates]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('team_members')
        .select('id, email, full_name')
        .eq('status', 'active');
      if (data) {
        const map: Record<string, string> = {};
        for (const m of data as { id: string; email: string; full_name: string | null }[]) {
          map[m.id] = m.full_name || m.email;
        }
        setAssigneeMap(map);
      }
    })();
  }, [fetchLeads]);

  useEffect(() => {
    if (activeView !== 'inbox_hub') {
      (async () => {
        const { count } = await supabase
          .from('chat_conversations')
          .select('*', { count: 'exact', head: true })
          .gt('unread_count', 0);
        setUnreadCount(count || 0);
      })();
    }
  }, [activeView, inboxRefreshKey]);

  useEffect(() => {
    if (activeView !== 'inbox_hub') {
      (async () => {
        const { count } = await supabase
          .from('wa_conversations')
          .select('*', { count: 'exact', head: true })
          .gt('unread_count', 0);
        setWaUnreadCount(count || 0);
      })();
    }
  }, [activeView, waRefreshKey]);

  useEffect(() => {
    if (activeView === 'leads') {
      (async () => {
        const { data } = await supabase
          .from('lead_followups')
          .select('*')
          .in('status', ['pending', 'snoozed'])
          .order('reminder_at', { ascending: true })
          .limit(30);
        setDashFollowups((data || []) as FollowUp[]);
      })();
    }
  }, [activeView, fetchLeads]);

  const updateLeadInState = useCallback((id: string, updates: Partial<Lead>) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)));
    setSelectedLead((prev) => (prev && prev.id === id ? { ...prev, ...updates } : prev));
  }, []);

  const updateLead = useCallback(async (id: string, updates: Partial<Lead>) => {
    // Pipeline Auto-Assign: if status is changing from 'new' to another stage, auto-assign to current user
    let autoAssignedTo: string | null = null;
    if (updates.status && updates.status !== 'new' && pipelineAutoAssignEnabled && pipelineAutoAssignStages.includes(updates.status)) {
      const currentLead = leads.find((l) => l.id === id);
      if (currentLead && currentLead.status === 'new' && !currentLead.assigned_to && currentMemberId) {
        autoAssignedTo = currentMemberId;
        updates = { ...updates, assigned_to: currentMemberId };
      }
    }

    updateLeadInState(id, updates);
    const { error: updateError } = await supabase
      .from('submissions')
      .update(updates)
      .eq('id', id);
    if (updateError) {
      setError(updateError.message);
    } else {
      if (updates.status) {
        if (updates.status === 'converted') {
        }
      }
      if (updates.tags) {
      }
      if (updates.assigned_to !== undefined) {
      }
    }
    if (updates.status) {
      const currentLead = leads.find((l) => l.id === id);
      if (currentLead) {
        sendMetaConversionEvent(id, { ...currentLead, ...updates }, updates.status);
      }
    }
    // Show toast if auto-assignment happened
    if (autoAssignedTo) {
      const lead = leads.find((l) => l.id === id);
      const member = Object.entries(assigneeMap).find(([mid]) => mid === autoAssignedTo);
      const assigneeName = member ? member[1] : 'you';
      setAutoAssignToast({ leadName: lead?.full_name || 'Lead', assigneeName });
      setTimeout(() => setAutoAssignToast(null), 4000);
    }
  }, [updateLeadInState, leads, session.user.id, pipelineAutoAssignEnabled, pipelineAutoAssignStages, currentMemberId, assigneeMap]);

  const deleteLead = useCallback(async (id: string) => {
    setLeads((prev) => prev.filter((l) => l.id !== id));
    setSelectedLead(null);
    const { error: deleteError } = await supabase
      .from('submissions')
      .update({ deleted_at: new Date().toISOString(), deleted_by: session.user.id })
      .eq('id', id);
    if (deleteError) {
      setError(deleteError.message);
      fetchLeads();
    } else {
    }
  }, [fetchLeads, session.user.id]);

  const bulkDeleteLeads = useCallback(async (ids: string[]) => {
    setBulkDeleting(true);
    setLeads((prev) => prev.filter((l) => !ids.includes(l.id)));
    const BATCH_SIZE = 100;
    let deleteError: PostgrestError | null = null;
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from('submissions')
        .update({ deleted_at: new Date().toISOString(), deleted_by: session.user.id })
        .in('id', batch);
      if (error) { deleteError = error; break; }
    }
    setBulkDeleting(false);
    setSelectedIds(new Set());
    setShowBulkDeleteConfirm(false);
    if (deleteError) {
      setError(deleteError.message);
      fetchLeads();
    }
  }, [fetchLeads, session.user.id]);

  const bulkUpdateStatus = useCallback(async (ids: string[], newStatus: LeadStatus) => {
    setBulkStatusUpdating(true);
    const BATCH_SIZE = 100;
    let updateError: PostgrestError | null = null;
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from('submissions')
        .update({ status: newStatus, last_contacted_at: new Date().toISOString() })
        .in('id', batch);
      if (error) { updateError = error; break; }
    }
    setBulkStatusUpdating(false);
    if (updateError) {
      setError(updateError.message);
      return 0;
    }
    setLeads((prev) => prev.map((l) => ids.includes(l.id) ? { ...l, status: newStatus } : l));
    for (const id of ids) {
      if (newStatus === 'converted') {
      }
      const currentLead = leads.find((l) => l.id === id);
      if (currentLead) sendMetaConversionEvent(id, { ...currentLead, status: newStatus }, newStatus);
    }
    return ids.length;
  }, [leads, session.user.id]);

  const bulkUpdateFund = useCallback(async (ids: string[], fundAmount: number) => {
    setBulkFundUpdating(true);
    const BATCH_SIZE = 100;
    let updateError: PostgrestError | null = null;
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from('submissions')
        .update({ fund_amount: fundAmount })
        .in('id', batch);
      if (error) { updateError = error; break; }
    }
    setBulkFundUpdating(false);
    if (updateError) {
      setError(updateError.message);
      return 0;
    }
    setLeads((prev) => prev.map((l) => ids.includes(l.id) ? { ...l, fund_amount: fundAmount } : l));
    for (const id of ids) {
    }
    return ids.length;
  }, [session.user.id]);

  const bulkAssignLeads = useCallback(async (ids: string[], assigneeId: string): Promise<number> => {
    setBulkAssignUpdating(true);
    const BATCH_SIZE = 100;
    let updateError: PostgrestError | null = null;
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from('submissions')
        .update({ assigned_to: assigneeId || null })
        .in('id', batch);
      if (error) { updateError = error; break; }
    }
    setBulkAssignUpdating(false);
    if (updateError) {
      setError(updateError.message);
      return 0;
    }
    setLeads((prev) => prev.map((l) => ids.includes(l.id) ? { ...l, assigned_to: assigneeId || null } : l));
    for (const id of ids) {
    }
    return ids.length;
  }, [session.user.id]);

  const restoreLead = useCallback(async (id: string) => {
    setTrashedLeads((prev) => prev.filter((l) => l.id !== id));
    const { error } = await supabase
      .from('submissions')
      .update({ deleted_at: null, deleted_by: null })
      .eq('id', id);
    if (error) {
      setError(error.message);
      fetchTrashedLeads();
    } else {
      fetchLeads();
    }
  }, [fetchLeads, fetchTrashedLeads]);

  const permanentlyDeleteLead = useCallback(async (id: string) => {
    setTrashedLeads((prev) => prev.filter((l) => l.id !== id));
    const { error } = await supabase
      .from('submissions')
      .delete()
      .eq('id', id);
    if (error) {
      setError(error.message);
      fetchTrashedLeads();
    }
  }, [fetchTrashedLeads]);

  const restoreAll = useCallback(async () => {
    setRestoringAll(true);
    const ids = trashedLeads.map((l) => l.id);
    const BATCH_SIZE = 100;
    let restoreError: PostgrestError | null = null;
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from('submissions')
        .update({ deleted_at: null, deleted_by: null })
        .in('id', batch);
      if (error) { restoreError = error; break; }
    }
    setRestoringAll(false);
    if (restoreError) {
      setError(restoreError.message);
      fetchTrashedLeads();
    } else {
      setTrashedLeads([]);
      fetchLeads();
    }
  }, [trashedLeads, fetchTrashedLeads, fetchLeads]);

  const emptyTrash = useCallback(async () => {
    setEmptyingTrash(true);
    const ids = trashedLeads.map((l) => l.id);
    const BATCH_SIZE = 100;
    let deleteError: PostgrestError | null = null;
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from('submissions')
        .delete()
        .in('id', batch);
      if (error) { deleteError = error; break; }
    }
    setEmptyingTrash(false);
    if (deleteError) {
      setError(deleteError.message);
      fetchTrashedLeads();
    } else {
      setTrashedLeads([]);
    }
  }, [trashedLeads, fetchTrashedLeads]);

  const deleteByFilter = useCallback(async (filterStatus: string, filterProduct: string, olderThanDays: number) => {
    setFilterDeleting(true);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    let query = supabase
      .from('submissions')
      .update({ deleted_at: new Date().toISOString(), deleted_by: session.user.id })
      .is('deleted_at', null)
      .lt('created_at', cutoffDate.toISOString());
    if (filterStatus !== 'all') query = query.eq('status', filterStatus);
    if (filterProduct !== 'all') query = query.eq('trading_product', filterProduct);
    const { data, error } = await query.select('id');
    setFilterDeleting(false);
    if (error) {
      setError(error.message);
      return 0;
    }
    const count = (data as { id: string }[])?.length || 0;
    if (count > 0) fetchLeads();
    return count;
  }, [fetchLeads, session.user.id]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const mergeDuplicates = useCallback(async (keepLead: Lead, removeLead: Lead): Promise<boolean> => {
    const updatePayload: Record<string, unknown> = {};
    if (!keepLead.email && removeLead.email) updatePayload.email = removeLead.email;
    if (!keepLead.mobile_number && removeLead.mobile_number) updatePayload.mobile_number = removeLead.mobile_number;
    if (!keepLead.state && removeLead.state) updatePayload.state = removeLead.state;
    if (!keepLead.notes && removeLead.notes) {
      updatePayload.notes = removeLead.notes;
    } else if (keepLead.notes && removeLead.notes) {
      updatePayload.notes = keepLead.notes + '\n---\n' + removeLead.notes;
    }
    if (!keepLead.fund_amount && removeLead.fund_amount != null) {
      updatePayload.fund_amount = removeLead.fund_amount;
    }
    if (keepLead.status === 'new' && removeLead.status !== 'new') {
      updatePayload.status = removeLead.status;
    }
    const keepTags = new Set(keepLead.tags || []);
    for (const t of (removeLead.tags || [])) keepTags.add(t);
    if (keepTags.size > (keepLead.tags || []).length) {
      updatePayload.tags = Array.from(keepTags);
    }
    if (!keepLead.assigned_to && removeLead.assigned_to) {
      updatePayload.assigned_to = removeLead.assigned_to;
    }

    let updatedLead: Lead | null = null;
    if (Object.keys(updatePayload).length > 0) {
      const { data, error: updateError } = await supabase
        .from('submissions')
        .update(updatePayload)
        .eq('id', keepLead.id)
        .select()
        .maybeSingle();
      if (updateError) {
        setError(updateError.message);
        return false;
      }
      updatedLead = data as Lead | null;
    }
    const { error: deleteError } = await supabase
      .from('submissions')
      .update({ deleted_at: new Date().toISOString(), deleted_by: session.user.id })
      .eq('id', removeLead.id);
    if (deleteError) {
      setError(deleteError.message);
      return false;
    }
    setLeads((prev) => {
      const updated = prev.map((l) => (l.id === keepLead.id ? (updatedLead ?? l) : l));
      return updated.filter((l) => l.id !== removeLead.id);
    });
    setSelectedLead(null);
    return true;
  }, [session.user.id]);

  const getNextAssignee = useCallback(async (): Promise<string | null> => {
    try {
      const { data: settings } = await supabase
        .from('lead_assignment_settings')
        .select('enabled, last_assigned_index, strategy')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (!settings?.enabled) return null;

      const { data: members } = await supabase
        .from('team_members')
        .select('id')
        .eq('owner_id', session.user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: true });

      if (!members || members.length === 0) return null;

      const memberIds = (members as { id: string }[]).map((m) => m.id);
      const strategy = (settings as { strategy?: string }).strategy || 'round_robin';

      if (strategy === 'workload') {
        const counts = new Map<string, number>();
        memberIds.forEach((id) => counts.set(id, 0));
        leads.forEach((l) => {
          if (l.assigned_to && counts.has(l.assigned_to)) {
            counts.set(l.assigned_to, counts.get(l.assigned_to)! + 1);
          }
        });
        let minId = memberIds[0];
        let minCount = Infinity;
        for (const id of memberIds) {
          const c = counts.get(id) || 0;
          if (c < minCount) { minCount = c; minId = id; }
        }
        return minId;
      }

      if (strategy === 'expertise') {
        const stats = new Map<string, { total: number; converted: number }>();
        memberIds.forEach((id) => stats.set(id, { total: 0, converted: 0 }));
        leads.forEach((l) => {
          if (l.assigned_to && stats.has(l.assigned_to)) {
            const s = stats.get(l.assigned_to)!;
            s.total++;
            if (l.status === 'converted') s.converted++;
          }
        });
        let bestId = memberIds[0];
        let bestRate = -1;
        for (const id of memberIds) {
          const s = stats.get(id)!;
          const rate = s.total > 0 ? s.converted / s.total : 0;
          if (rate > bestRate) { bestRate = rate; bestId = id; }
        }
        return bestId;
      }

      // Default: round_robin
      const nextIndex = (settings.last_assigned_index + 1) % memberIds.length;
      const assigneeId = memberIds[nextIndex];

      await supabase
        .from('lead_assignment_settings')
        .update({ last_assigned_index: nextIndex, updated_at: new Date().toISOString() })
        .eq('user_id', session.user.id);

      return assigneeId;
    } catch {
      return null;
    }
  }, [session.user.id, leads]);

  const addLead = useCallback(async (form: NewLeadForm): Promise<boolean> => {
    const assigneeId = await getNextAssignee();
    const { data, error: insertError } = await supabase
      .from('submissions')
      .insert({
        full_name: form.full_name,
        mobile_number: form.mobile_number,
        email: form.email,
        state: form.state,
        trading_product: form.trading_product,
        status: form.status,
        notes: form.notes,
        fund_amount: form.fund_amount,
        custom_data: {
          service_interest: form.service_interest,
          referral_readiness: form.referral_readiness,
          funding_readiness: form.funding_readiness,
        },
        tags: [],
        assigned_to: assigneeId,
        user_id: session.user.id,
        lead_source: form.lead_source || 'Manual Entry',
      })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      return false;
    }

    if (data) {
      setLeads((prev) => [data as Lead, ...prev]);
    }
    return true;
  }, [session.user.id, getNextAssignee]);

  const mergeLead = useCallback(async (existingLead: Lead, newForm: NewLeadForm): Promise<boolean> => {
    const updatePayload: Record<string, unknown> = {};
    if (!existingLead.email && newForm.email.trim()) updatePayload.email = newForm.email.trim();
    if (!existingLead.mobile_number && newForm.mobile_number.trim()) updatePayload.mobile_number = newForm.mobile_number.trim();
    if (!existingLead.state && newForm.state.trim()) updatePayload.state = newForm.state.trim();
    if (!existingLead.notes && newForm.notes.trim()) {
      updatePayload.notes = newForm.notes.trim();
    } else if (existingLead.notes && newForm.notes.trim()) {
      updatePayload.notes = existingLead.notes + '\n---\n' + newForm.notes.trim();
    }
    if (Object.keys(updatePayload).length === 0) return true;

    const { data, error: updateError } = await supabase
      .from('submissions')
      .update(updatePayload)
      .eq('id', existingLead.id)
      .select()
      .maybeSingle();

    if (updateError) {
      setError(updateError.message);
      return false;
    }

    if (data) {
      setLeads((prev) => prev.map((l) => (l.id === existingLead.id ? (data as Lead) : l)));
    }
    return true;
  }, []);

  const bulkUploadLeads = useCallback(async (rows: NewLeadForm[]): Promise<{ success: number; failed: number }> => {
    let assignees: (string | null)[] = [];
    try {
      const { data: settings } = await supabase
        .from('lead_assignment_settings')
        .select('enabled, last_assigned_index')
        .maybeSingle();

      if (settings?.enabled) {
        const { data: members } = await supabase
          .from('team_members')
          .select('id')
          .eq('status', 'active')
          .order('created_at', { ascending: true });

        if (members && members.length > 0) {
          const memberIds = (members as { id: string }[]).map((m) => m.id);
          assignees = rows.map((_, i) => memberIds[(settings.last_assigned_index + 1 + i) % memberIds.length]);
          const newLastIndex = (settings.last_assigned_index + rows.length) % memberIds.length;
          await supabase
            .from('lead_assignment_settings')
            .update({ last_assigned_index: newLastIndex, updated_at: new Date().toISOString() })
            .eq('user_id', session.user.id);
        }
      }
    } catch { /* auto-assign is best-effort */ }

    const insertRows = rows.map((r, i) => ({
      full_name: r.full_name,
      mobile_number: r.mobile_number,
      email: r.email,
      state: r.state,
      trading_product: r.trading_product,
      status: r.status,
      notes: r.notes,
      fund_amount: r.fund_amount,
      custom_data: {
        service_interest: r.service_interest,
        referral_readiness: r.referral_readiness,
        funding_readiness: r.funding_readiness,
      },
      tags: [],
      assigned_to: assignees[i] ?? null,
      user_id: session.user.id,
      lead_source: 'Bulk Upload',
    }));

    const BATCH_SIZE = 500;
    let totalSuccess = 0;
    let totalFailed = 0;
    let lastError = '';

    for (let i = 0; i < insertRows.length; i += BATCH_SIZE) {
      const batch = insertRows.slice(i, i + BATCH_SIZE);
      try {
        const { data, error: insertError } = await supabase
          .from('submissions')
          .insert(batch)
          .select();

        if (insertError) {
          lastError = insertError.message;
          totalFailed += batch.length;
        } else if (data) {
          totalSuccess += data.length;
          setLeads((prev) => [...(data as Lead[]), ...prev]);
        }
      } catch {
        totalFailed += batch.length;
      }
    }

    if (totalFailed > 0 && totalSuccess === 0) {
      setError(lastError || 'Upload failed. Please check your data and try again.');
    }

    return { success: totalSuccess, failed: totalFailed };
  }, [session.user.id]);

  const dateRange = useMemo((): { start: Date | null; end: Date | null } => {
    if (dateFilter === 'all') return { start: null, end: null };

    const now = new Date();
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    if (dateFilter === 'today') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      return { start, end: todayEnd };
    }

    if (dateFilter === 'yesterday') {
      const start = new Date();
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    if (dateFilter === 'last_7_days') {
      const start = new Date();
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      return { start, end: todayEnd };
    }

    if (dateFilter === 'this_week') {
      const day = now.getDay();
      const start = new Date();
      start.setDate(start.getDate() - day);
      start.setHours(0, 0, 0, 0);
      return { start, end: todayEnd };
    }

    if (dateFilter === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return { start, end: todayEnd };
    }

    if (dateFilter === 'this_year') {
      const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      return { start, end: todayEnd };
    }

    if (dateFilter === 'custom') {
      if (!customDateStart && !customDateEnd) return { start: null, end: null };
      const start = customDateStart ? new Date(customDateStart + 'T00:00:00') : null;
      const end = customDateEnd ? new Date(customDateEnd + 'T23:59:59') : null;
      return { start, end };
    }

    return { start: null, end: null };
  }, [dateFilter, customDateStart, customDateEnd]);

  const dateFilterLabel = useMemo(() => {
    if (dateFilter === 'all') return 'All Time';
    if (dateFilter === 'today') return 'Today';
    if (dateFilter === 'yesterday') return 'Yesterday';
    if (dateFilter === 'last_7_days') return 'Last 7 Days';
    if (dateFilter === 'this_week') return 'This Week';
    if (dateFilter === 'this_month') return 'This Month';
    if (dateFilter === 'this_year') return 'This Year';
    if (dateFilter === 'custom') {
      if (customDateStart && customDateEnd) {
        const s = new Date(customDateStart).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        const e = new Date(customDateEnd).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        return `${s} - ${e}`;
      }
      return 'Custom Range';
    }
    return 'All Time';
  }, [dateFilter, customDateStart, customDateEnd]);

  const duplicateLeadIds = useMemo(() => {
    const seen = new Map<string, string>();
    const dupIds = new Set<string>();
    const normPhone = (s: string) => s.replace(/[\s+\-()]/g, '').toLowerCase();
    const normEmail = (s: string) => s.trim().toLowerCase();
    for (const l of leads) {
      const e = normEmail(l.email);
      const p = normPhone(l.mobile_number);
      const key = e || p;
      if (!key) continue;
      if (seen.has(key)) {
        dupIds.add(l.id);
        dupIds.add(seen.get(key)!);
      } else {
        seen.set(key, l.id);
      }
    }
    return dupIds;
  }, [leads]);

  const isAgent = userRole === 'agent';
  const showOnlyMyLeads = isAgent && viewMode2 === 'my' && currentMemberId;

  const filteredLeads = useMemo(() => {
    let result = [...leads];

    if (showOnlyMyLeads) {
      result = result.filter((l) => l.assigned_to === currentMemberId);
    }

    if (dateRange.start || dateRange.end) {
      result = result.filter((l) => {
        const d = new Date(l.created_at);
        if (dateRange.start && d < dateRange.start) return false;
        if (dateRange.end && d > dateRange.end) return false;
        return true;
      });
    }

    if (productFilter !== 'all') {
      result = result.filter((l) => l.trading_product === productFilter);
    }

    if (statusFilter !== 'all') {
      result = result.filter((l) => l.status === statusFilter);
    }

    if (dupesOnly) {
      result = result.filter((l) => duplicateLeadIds.has(l.id));
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (l) =>
          l.full_name.toLowerCase().includes(q) ||
          l.email.toLowerCase().includes(q) ||
          l.mobile_number.toLowerCase().includes(q) ||
          l.state.toLowerCase().includes(q) ||
          (l.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'created_at') {
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else {
        cmp = String(a[sortKey]).localeCompare(String(b[sortKey]));
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [leads, search, productFilter, statusFilter, sortKey, sortDir, dateRange, dupesOnly, duplicateLeadIds, showOnlyMyLeads, currentMemberId]);

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pagedLeads = filteredLeads.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const allPageSelected = pagedLeads.length > 0 && pagedLeads.every((l) => selectedIds.has(l.id));
  const somePageSelected = pagedLeads.some((l) => selectedIds.has(l.id)) && !allPageSelected;

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const allPageIds = pagedLeads.map((l) => l.id);
      const allSelected = allPageIds.every((id) => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        allPageIds.forEach((id) => next.delete(id));
        return next;
      }
      const next = new Set(prev);
      allPageIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const selectAllLeads = () => {
    setSelectedIds(new Set(filteredLeads.map((l) => l.id)));
  };

  const stats = useMemo(() => {
    const src = showOnlyMyLeads ? leads.filter((l) => l.assigned_to === currentMemberId) : leads;
    const total = src.length;
    const algo = src.filter((l) => l.trading_product === 'algo').length;
    const tv = src.filter((l) => l.trading_product === 'tradingview_premium').length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = src.filter((l) => new Date(l.created_at) >= today).length;
    const interested = src.filter((l) => l.status === 'interested').length;
    const converted = src.filter((l) => l.status === 'converted').length;
    const setupCost = converted * setupCostPerClient;
    return { total, algo, tv, todayCount, interested, converted, setupCost };
  }, [leads, showOnlyMyLeads, currentMemberId]);

  const pipelineStats = useMemo(() => {
    const map: Record<LeadStatus, number> = {
      new: 0, called_no_response: 0, called_responded: 0, interested: 0, not_interested: 0, converted: 0,
    };
    filteredLeads.forEach((l) => { map[l.status]++; });
    return map;
  }, [filteredLeads]);

  const fundStats = useMemo(() => {
    const src = showOnlyMyLeads ? leads.filter((l) => l.assigned_to === currentMemberId) : leads;
    const total = src.reduce((sum, l) => sum + (l.fund_amount || 0), 0);
    const byStage: Record<LeadStatus, number> = {
      new: 0, called_no_response: 0, called_responded: 0, interested: 0, not_interested: 0, converted: 0,
    };
    src.forEach((l) => { byStage[l.status] += l.fund_amount || 0; });
    return { total, byStage };
  }, [leads, showOnlyMyLeads, currentMemberId]);

  const formatFund = (amount: number) => '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
    setPage(0);
  };

  const handleExport = () => {
    const headers = ['Name', 'Mobile', 'Email', 'State', 'Product', 'Fund Amount', 'Status', 'Tags', 'Notes', 'Submitted At', 'Last Contacted'];
    const rows = filteredLeads.map((l) => [
      l.full_name,
      l.mobile_number,
      l.email,
      l.state,
      l.trading_product === 'algo' ? 'Trading Algo' : 'TradingView Premium',
      l.fund_amount != null ? String(l.fund_amount) : '',
      l.status.replace(/_/g, ' '),
      (l.tags || []).join('; '),
      l.notes || '',
      new Date(l.created_at).toLocaleString('en-IN'),
      l.last_contacted_at ? new Date(l.last_contacted_at).toLocaleString('en-IN') : '',
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHrs / 24);

    if (diffHrs < 1) return 'Just now';
    if (diffHrs < 24) return `${diffHrs}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const adminEmail = session.user.email || 'Admin';
  const userMeta = session.user.user_metadata || {};
  const adminName = [userMeta.first_name, userMeta.last_name].filter(Boolean).join(' ').trim() || adminEmail;

  const sidebarContent = (
    <>
      <div className={`crm-sidebar-brand ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="crm-sidebar-logo">
          <TrendingUp size={22} strokeWidth={2.5} />
        </div>
        {!sidebarCollapsed && (
          <div>
            <h2>LeadCentre</h2>
            <span>CRM Dashboard</span>
          </div>
        )}
        {!sidebarCollapsed && (
          <button className="crm-sidebar-toggle" onClick={toggleSidebar} aria-label="Collapse sidebar" title="Collapse sidebar">
            <PanelLeft size={18} />
          </button>
        )}
      </div>

      {sidebarCollapsed && (
        <button className="crm-sidebar-toggle-collapsed" onClick={toggleSidebar} aria-label="Expand sidebar" title="Expand sidebar">
          <PanelLeft size={18} />
        </button>
      )}

      <nav className="crm-sidebar-nav">
        {sidebarSections.main && (
        <div className="crm-nav-section">
          {!sidebarCollapsed && <span className="crm-nav-label">MAIN</span>}
          <a className={`crm-nav-item ${activeView === 'dashboard' ? 'active' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`} onClick={() => { navigateToView('dashboard'); setMobileSidebarOpen(false); }} style={{ cursor: 'pointer' }} title={sidebarCollapsed ? 'Dashboard' : undefined}>
            <LayoutGrid size={18} /> {!sidebarCollapsed && 'Dashboard'}
          </a>
          {sectionVisibility.leads && (
          <a className={`crm-nav-item ${activeView === 'leads' ? 'active' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`} onClick={() => { navigateToView('leads'); setMobileSidebarOpen(false); setMobileNav('leads'); }} style={{ cursor: 'pointer' }} title={sidebarCollapsed ? 'Leads' : undefined}>
            <Users size={18} /> {!sidebarCollapsed && 'Leads'}
            {!sidebarCollapsed && <span className="crm-nav-badge">{stats.total}</span>}
          </a>
          )}
          {sectionVisibility.brokers && (
          <a className={`crm-nav-item ${activeView === 'brokers' ? 'active' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`} onClick={() => { navigateToView('brokers'); setMobileSidebarOpen(false); setMobileNav('leads'); }} style={{ cursor: 'pointer' }} title={sidebarCollapsed ? 'Broker Tracker' : undefined}>
            <TrendingUp size={18} /> {!sidebarCollapsed && 'Broker Tracker'}
          </a>
          )}
        </div>
        )}
        {sidebarSections.inbox && sectionVisibility.inbox && (
        <div className="crm-nav-section">
          {!sidebarCollapsed && <span className="crm-nav-label">INBOX</span>}
          <a className={`crm-nav-item ${activeView === 'inbox_hub' ? 'active' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`} onClick={() => { if (permissions.inbox) { navigateToView('inbox_hub'); setMobileSidebarOpen(false); setMobileNav('leads'); } }} style={{ cursor: permissions.inbox ? 'pointer' : 'not-allowed', position: 'relative', opacity: permissions.inbox ? 1 : 0.4 }} title={sidebarCollapsed ? 'Shared Inbox' : undefined}>
            <InboxIcon size={18} /> {!sidebarCollapsed && 'Shared Inbox'}
            {!sidebarCollapsed && (unreadCount + waUnreadCount + emailUnreadCount) > 0 && permissions.inbox && (
              <span className="crm-nav-badge" style={{ background: 'rgba(239,68,68,0.15)', color: '#dc2626', fontWeight: 700 }}>{unreadCount + waUnreadCount + emailUnreadCount}</span>
            )}
            {sidebarCollapsed && (unreadCount + waUnreadCount + emailUnreadCount) > 0 && permissions.inbox && (
              <span className="crm-nav-badge-dot" />
            )}
          </a>
        </div>
        )}
        {permissions.broadcasts && sidebarSections.campaigns && (
        <div className="crm-nav-section">
          {!sidebarCollapsed && <span className="crm-nav-label">CAMPAIGNS</span>}
          {sectionVisibility.broadcasts && (
          <a className={`crm-nav-item ${activeView === 'broadcast_hub' ? 'active' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`} onClick={() => { navigateToView('broadcast_hub'); setMobileSidebarOpen(false); setMobileNav('leads'); }} style={{ cursor: 'pointer' }} title={sidebarCollapsed ? 'Broadcasts' : undefined}>
            <Send size={18} /> {!sidebarCollapsed && 'Broadcasts'}
          </a>
          )}
        </div>
        )}
        {permissions.analytics && sidebarSections.analytics && (
        <div className="crm-nav-section">
          {!sidebarCollapsed && <span className="crm-nav-label">ANALYTICS</span>}
          {sectionVisibility.analytics && (
          <a className={`crm-nav-item ${activeView === 'analytics_hub' ? 'active' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`} onClick={() => { navigateToView('analytics_hub'); setMobileSidebarOpen(false); setMobileNav('leads'); }} style={{ cursor: 'pointer' }} title={sidebarCollapsed ? 'Analytics' : undefined}>
            <BarChart3 size={18} /> {!sidebarCollapsed && 'Analytics'}
          </a>
          )}
          {sectionVisibility.lead_tracker && (
          <a className={`crm-nav-item ${activeView === 'lead_tracker' ? 'active' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`} onClick={() => { navigateToView('lead_tracker'); setMobileSidebarOpen(false); setMobileNav('leads'); }} style={{ cursor: 'pointer' }} title={sidebarCollapsed ? 'Lead Tracker' : undefined}>
            <Radar size={18} /> {!sidebarCollapsed && 'Lead Tracker'}
          </a>
          )}
          <a className={`crm-nav-item ${activeView === 'meta_ads' ? 'active' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`} onClick={() => { navigateToView('meta_ads'); setMobileSidebarOpen(false); setMobileNav('leads'); }} style={{ cursor: 'pointer' }} title={sidebarCollapsed ? 'Meta Ads Manager' : undefined}>
            <TrendingUp size={18} /> {!sidebarCollapsed && 'Meta Ads Manager'}
          </a>
        </div>
        )}
        {(permissions.broadcasts || permissions.followUps) && sidebarSections.tools && (
        <div className="crm-nav-section">
          {!sidebarCollapsed && <span className="crm-nav-label">TOOLS</span>}
          {permissions.broadcasts && sectionVisibility.templates && (
          <a className={`crm-nav-item ${activeView === 'message_templates' ? 'active' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`} onClick={() => { navigateToView('message_templates'); setMobileSidebarOpen(false); setMobileNav('leads'); }} style={{ cursor: 'pointer' }} title={sidebarCollapsed ? 'Templates' : undefined}>
            <FileTextIcon size={18} /> {!sidebarCollapsed && 'Templates'}
          </a>
          )}
          {permissions.followUps && sectionVisibility.followups && (
          <a className={`crm-nav-item ${activeView === 'followups' ? 'active' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`} onClick={() => { navigateToView('followups'); setMobileSidebarOpen(false); setMobileNav('leads'); }} style={{ cursor: 'pointer', position: 'relative' }} title={sidebarCollapsed ? 'Follow-Ups' : undefined}>
            <Bell size={18} /> {!sidebarCollapsed && 'Follow-Ups'}
            {!sidebarCollapsed && dashFollowups.filter((f) => f.status === 'pending' && new Date(f.reminder_at).getTime() <= Date.now()).length > 0 && (
              <span className="crm-nav-badge" style={{ background: 'rgba(239,68,68,0.15)', color: '#dc2626', fontWeight: 700 }}>
                {dashFollowups.filter((f) => f.status === 'pending' && new Date(f.reminder_at).getTime() <= Date.now()).length}
              </span>
            )}
            {sidebarCollapsed && dashFollowups.filter((f) => f.status === 'pending' && new Date(f.reminder_at).getTime() <= Date.now()).length > 0 && (
              <span className="crm-nav-badge-dot" />
            )}
          </a>
          )}
          {permissions.automations && sectionVisibility.automations && (
          <a className={`crm-nav-item ${activeView === 'automations' ? 'active' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`} onClick={() => { navigateToView('automations'); setMobileSidebarOpen(false); setMobileNav('leads'); }} style={{ cursor: 'pointer' }} title={sidebarCollapsed ? 'Automations' : undefined}>
            <Zap size={18} /> {!sidebarCollapsed && 'Automations'}
          </a>
          )}
          <a className={`crm-nav-item ${activeView === 'wa_chatbot' ? 'active' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`} onClick={() => { navigateToView('wa_chatbot'); setMobileSidebarOpen(false); setMobileNav('leads'); }} style={{ cursor: 'pointer' }} title={sidebarCollapsed ? 'WhatsApp Chatbot' : undefined}>
            <Bot size={18} /> {!sidebarCollapsed && 'Chatbot'}
          </a>
          <a className={`crm-nav-item ${activeView === 'wa_drips' ? 'active' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`} onClick={() => { navigateToView('wa_drips'); setMobileSidebarOpen(false); setMobileNav('leads'); }} style={{ cursor: 'pointer' }} title={sidebarCollapsed ? 'Drip Sequences' : undefined}>
            <Droplets size={18} /> {!sidebarCollapsed && 'Drip Sequences'}
          </a>
          <a className={`crm-nav-item ${activeView === 'wa_optout' ? 'active' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`} onClick={() => { navigateToView('wa_optout'); setMobileSidebarOpen(false); setMobileNav('leads'); }} style={{ cursor: 'pointer' }} title={sidebarCollapsed ? 'Opt-Out Management' : undefined}>
            <ShieldBan size={18} /> {!sidebarCollapsed && 'Opt-Out'}
          </a>
        </div>
        )}
        {!sidebarCollapsed && sidebarSections.pipeline && sectionVisibility.pipeline && (
        <div className="crm-nav-section">
          <span className="crm-nav-label">PIPELINE</span>
          <div className="crm-pipeline-funnel">
            <div className="crm-pipeline-funnel-summary">
              <div className="crm-pipeline-funnel-total">
                <span className="crm-pipeline-funnel-total-num">{stats.total}</span>
                <span className="crm-pipeline-funnel-total-label">Total Leads</span>
              </div>
              {fundStats.total > 0 && (
                <div className="crm-pipeline-funnel-funds">
                  <DollarSign size={12} /> {formatFund(fundStats.total)}
                </div>
              )}

            </div>
            <div className="crm-pipeline-funnel-bars">
              {pipelineStages.map((stage) => {
                const count = pipelineStats[stage.key];
                const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                const colors = STAGE_COLORS[stage.color];
                return (
                  <div
                    key={stage.key}
                    className={`crm-pipeline-funnel-row ${statusFilter === stage.key ? 'active' : ''}`}
                    onClick={() => { setStatusFilter(stage.key); setViewMode('table'); setMobileSidebarOpen(false); setMobileNav('leads'); }}
                  >
                    <div className="crm-pipeline-funnel-row-top">
                      <span className="crm-pipeline-funnel-row-label">
                        <span className="crm-pipeline-dot" style={{ background: colors.dot }} />
                        {stage.label}
                      </span>
                      <span className="crm-pipeline-funnel-row-count" style={{ color: colors.text }}>{count}</span>
                    </div>
                    <div className="crm-pipeline-funnel-bar-track">
                      <div
                        className="crm-pipeline-funnel-bar-fill"
                        style={{ width: `${Math.max(pct, count > 0 ? 8 : 0)}%`, background: colors.dot }}
                      />
                    </div>
                    {fundStats.byStage[stage.key] > 0 && (
                      <span className="crm-pipeline-funnel-row-fund">{formatFund(fundStats.byStage[stage.key])}</span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className={`crm-pipeline-funnel-all ${statusFilter === 'all' ? 'active' : ''}`} onClick={() => { setStatusFilter('all'); setMobileSidebarOpen(false); }}>
              <Filter size={14} /> All Statuses
            </div>
          </div>
        </div>
        )}
      </nav>
      <div className={`crm-sidebar-footer ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="crm-nav-user">
          <div className="crm-nav-avatar" style={{ overflow: 'hidden', background: userMeta.profile_pic_url ? 'transparent' : undefined }}>
            {userMeta.profile_pic_url ? (
              <img src={userMeta.profile_pic_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              adminName[0]?.toUpperCase()
            )}
          </div>
          {!sidebarCollapsed && (
            <div className="crm-nav-user-info">
              <strong>{adminName}</strong>
              <span style={{ textTransform: 'capitalize' }}>{userRole === 'owner' ? 'Owner' : userRole}</span>
            </div>
          )}
        </div>
        <div className={`crm-sidebar-footer-actions ${sidebarCollapsed ? 'collapsed' : ''}`}>
          {permissions.settings && (
            <button className={`crm-nav-item ${activeView === 'settings' ? 'active' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`} onClick={() => { navigateToView('settings'); setMobileSidebarOpen(false); setMobileNav('leads'); }} style={{ cursor: 'pointer', flex: 1 }} title={sidebarCollapsed ? 'Settings' : undefined}>
              <SettingsIcon size={18} /> {!sidebarCollapsed && 'Settings'}
            </button>
          )}
          <button
            className={`crm-nav-item crm-theme-toggle ${sidebarCollapsed ? 'collapsed' : ''}`}
            onClick={() => setDarkMode((v) => !v)}
            style={{ cursor: 'pointer', flexShrink: 0 }}
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            className={`crm-nav-item ${sidebarCollapsed ? 'collapsed' : ''}`}
            onClick={handleSignOut}
            style={{ cursor: 'pointer', color: 'var(--text-dark)', flexShrink: 0 }}
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="crm-dashboard">
      {/* Auto-Assign Toast */}
      {autoAssignToast && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
          background: '#0f766e', color: 'var(--bg-card)', borderRadius: '10px',
          padding: '12px 18px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex', alignItems: 'center', gap: '10px',
          fontSize: '0.85rem', fontWeight: 600,
          animation: 'autoAssignToastIn 0.3s ease-out',
        }}>
          <UserCheck size={18} />
          <span>{autoAssignToast.leadName} auto-assigned to {autoAssignToast.assigneeName}</span>
        </div>
      )}
      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div className="crm-mobile-sidebar-overlay" onClick={() => setMobileSidebarOpen(false)} />
      )}

      {/* Sidebar (desktop) */}
      <aside className={`crm-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>{sidebarContent}</aside>

      {/* Mobile Sidebar Drawer */}
      <aside className={`crm-mobile-sidebar ${mobileSidebarOpen ? 'open' : ''}`}>
        <button className="crm-mobile-sidebar-close" onClick={() => setMobileSidebarOpen(false)} aria-label="Close menu">
          <X size={20} />
        </button>
        {sidebarContent}
      </aside>

      {/* Main */}
      <main className="crm-main">
        {/* Mobile Header */}
        <header className="crm-mobile-header">
          <button className="crm-mobile-menu-btn" onClick={() => setMobileSidebarOpen(true)} aria-label="Open menu">
            <Menu size={22} />
          </button>
          <div className="crm-mobile-header-title">
            <TrendingUp size={18} strokeWidth={2.5} />
            <span>LeadCentre</span>
          </div>
          <button className="crm-mobile-refresh-btn" onClick={fetchLeads} disabled={loading} aria-label="Refresh">
            {loading ? <Loader2 size={20} className="crm-spin" /> : <ArrowUpRight size={20} />}
          </button>
        </header>

        {activeView === 'dashboard' ? (
          <DashboardOverview
            session={session}
            leads={leads}
            followUps={dashFollowups}
            onGoToLeads={() => navigateToView('leads')}
            onGoToInbox={() => permissions.inbox && navigateToView('inbox_hub')}
            onGoToWhatsApp={() => permissions.inbox && navigateToView('inbox_hub')}
            onGoToEmailAnalytics={() => navigateToView('analytics_hub')}
            onGoToMessageTemplates={() => navigateToView('message_templates')}
            onGoToBroadcast={() => permissions.broadcasts && navigateToView('broadcast_hub')}
            onGoToFollowUps={() => permissions.followUps && navigateToView('followups')}
            onGoToAnalytics={() => permissions.analytics && navigateToView('analytics_hub')}
            onGoToAddLead={() => permissions.addLeads && setShowAddLead(true)}
            onGoToLeaderboard={() => navigateToView('leaderboard')}
            onGoToGoals={() => navigateToView('goals')}
            onGoToWinLoss={() => navigateToView('win_loss')}
            onGoToDuplicates={() => navigateToView('duplicates')}
          />
        ) : activeView === 'inbox_hub' ? (
          <InboxHub
            session={session}
            showTelegram={showTelegramInbox}
            showWhatsApp={showWhatsAppInbox}
            ChatInbox={ChatInbox}
            WhatsAppInbox={WhatsAppInbox}
            onTotalUnreadChange={() => {}}
            onCall={(number) => { window.location.href = `tel:${number.replace(/[^+\d]/g, '')}`; }}
          />
        ) : activeView === 'settings' ? (
          <SettingsPage session={session} userRole={userRole} permissions={permissions} customPermissions={customPermissions} onBack={() => navigateToView('leads')} onSignOut={handleSignOut} onInboxVisibilityChange={(tg, wa) => { setShowTelegramInbox(tg); setShowWhatsAppInbox(wa); }} onOpenRecycleBin={() => { fetchTrashedLeads(); setShowTrashModal(true); }} pipelineAutoAssignEnabled={pipelineAutoAssignEnabled} pipelineAutoAssignStages={pipelineAutoAssignStages} onPipelineAutoAssignChange={(enabled, stages) => { setPipelineAutoAssignEnabled(enabled); setPipelineAutoAssignStages(stages); }} onStageLabelsChange={async () => { const { data } = await supabase.from('pipeline_stage_labels').select('stage_key, label'); if (data) { const map: Record<string, string> = {}; for (const row of data as { stage_key: string; label: string }[]) { map[row.stage_key] = row.label; } setStageLabelMap(map); } }} sidebarSections={sidebarSections} onSidebarSectionChange={updateSidebarSection} sectionVisibility={sectionVisibility} onSectionVisibilityChange={(key, visible) => setSectionVisibility((prev) => ({ ...prev, [key]: visible }))} />
        ) : activeView === 'analytics_hub' ? (
          <AnalyticsHub session={session} onBack={() => navigateToView('dashboard')} />
        ) : activeView === 'message_templates' ? (
          <TemplatesHub session={session} onBack={() => navigateToView('dashboard')} />
        ) : activeView === 'broadcast_hub' ? (
          <BroadcastHub session={session} onBack={() => navigateToView('dashboard')} />
        ) : activeView === 'followups' ? (
          <FollowUpsPage session={session} onBack={() => navigateToView('dashboard')} onCall={(number) => { window.location.href = `tel:${number.replace(/[^+\d]/g, '')}`; }} />
        ) : activeView === 'leaderboard' ? (
          <AgentLeaderboard session={session} leads={leads} onBack={() => navigateToView('dashboard')} />
        ) : activeView === 'goals' ? (
          <GoalTracking session={session} leads={leads} onBack={() => navigateToView('dashboard')} />
        ) : activeView === 'win_loss' ? (
          <WinLossAnalysis session={session} leads={leads} onBack={() => navigateToView('dashboard')} />
        ) : activeView === 'duplicates' ? (
          <DuplicateDetectionView leads={leads} onBack={() => navigateToView('dashboard')} onMerge={mergeDuplicates} assigneeMap={assigneeMap} />
        ) : activeView === 'automations' ? (
          <AutomationBuilder session={session} onBack={() => navigateToView('dashboard')} stages={pipelineStages} />
        ) : activeView === 'wa_chatbot' ? (
          <WhatsAppChatbotBuilder session={session} onBack={() => navigateToView('dashboard')} />
        ) : activeView === 'wa_drips' ? (
          <WhatsAppDripSequences session={session} onBack={() => navigateToView('dashboard')} />
        ) : activeView === 'wa_optout' ? (
          <WhatsAppOptOutManager session={session} onBack={() => navigateToView('dashboard')} />
        ) : activeView === 'brokers' ? (
          <BrokerTrackerPage session={session} onBack={() => navigateToView('dashboard')} />
        ) : activeView === 'lead_tracker' ? (
          <LeadTrackerPage leads={leads} session={session} onBack={() => navigateToView('dashboard')} />
        ) : activeView === 'meta_ads' ? (
          <MetaAdsManager session={session} />
        ) : activeView === 'heatmap' ? (
          <div className="dash-overview">
            <div className="dash-page-header">
              <button className="dash-back-btn" onClick={() => navigateToView('dashboard')}><ArrowLeft size={18} /> Back</button>
              <h1>Activity Heatmap</h1>
              <p>See when your leads are most active across all channels</p>
            </div>
            <LeadFollowupHeatmap />
          </div>
        ) : (
        <>
        {/* Desktop Top Bar */}
        <header className="crm-topbar">
          <div>
            <h1>Leads Overview</h1>
            <p>Manage and track all your incoming leads through your call pipeline</p>
          </div>
          <div className="crm-topbar-actions">
            <div className="crm-notif-wrap">
              <button
                className="crm-notif-btn"
                onClick={() => navigateToView('followups')}
                aria-label="Follow-up reminders"
              >
                <Bell size={18} />
                {dashFollowups.filter((f) => f.status === 'pending' && new Date(f.reminder_at).getTime() <= Date.now()).length > 0 && (
                  <span className="crm-notif-dot" />
                )}
              </button>
            </div>
            {permissions.addLeads && (
              <button className="crm-btn-add-lead" onClick={() => setShowAddLead(true)}>
                <Plus size={16} /> Add Lead
              </button>
            )}
            {permissions.bulkUpload && (
              <button className="crm-btn-bulk-upload" onClick={() => setShowBulkUpload(true)}>
                <Upload size={16} /> Bulk Upload
              </button>
            )}
            {permissions.dialer && (
              <button className="crm-btn-dialer" onClick={() => setShowDialer(true)}>
                <DialpadIcon size={16} /> Dialer
              </button>
            )}
            <div className="crm-view-toggle">
              <button className={viewMode === 'table' ? 'active' : ''} onClick={() => setViewMode('table')}>
                <TableIcon size={16} /> Table
              </button>
              <button className={viewMode === 'pipeline' ? 'active' : ''} onClick={() => setViewMode('pipeline')}>
                <LayoutGrid size={16} /> Pipeline
              </button>
            </div>
            {permissions.export && (
              <button className="crm-btn-secondary" onClick={handleExport} disabled={filteredLeads.length === 0}>
                <Download size={16} /> Export
              </button>
            )}
            <button className="crm-btn-refresh" onClick={fetchLeads} disabled={loading}>
              {loading ? <Loader2 size={16} className="crm-spin" /> : <ArrowUpRight size={16} />}
              Refresh
            </button>
          </div>
        </header>

        {/* Mobile Page Title */}
        <div className="crm-mobile-page-title">
          <div>
            <h1>Leads Overview</h1>
            <p>{stats.total} total leads</p>
          </div>
          <button className="crm-mobile-customize-btn" onClick={() => setMobileCustomizeOpen((open) => !open)} aria-expanded={mobileCustomizeOpen}>
            <SlidersHorizontal size={16} /> Customize
          </button>
        </div>

        {mobileCustomizeOpen && (
          <div className="crm-mobile-customize-panel">
            <div className="crm-mobile-customize-heading">
              <div>
                <strong>Customize mobile cards</strong>
                <span>Choose which cards appear on your phone.</span>
              </div>
              <button className="crm-mobile-customize-reset" onClick={() => setHiddenMobileStats([])} disabled={hiddenMobileStats.length === 0}>Show all</button>
            </div>
            <div className="crm-mobile-customize-options">
              {MOBILE_STAT_OPTIONS.map((option) => {
                const isVisible = !hiddenMobileStats.includes(option.key);
                return (
                  <button key={option.key} className={`crm-mobile-customize-option ${isVisible ? 'active' : ''}`} onClick={() => toggleMobileStat(option.key)} aria-pressed={isVisible}>
                    <span>{option.label}</span>
                    {isVisible ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="crm-stats-grid">
          <div className={`crm-stat-card crm-stat-primary ${hiddenMobileStats.includes('total') ? 'crm-stat-mobile-hidden' : ''}`}>
            <div className="crm-stat-icon"><Users size={22} /></div>
            <div className="crm-stat-body">
              <span className="crm-stat-value">{stats.total}</span>
              <span className="crm-stat-label">Total Leads</span>
            </div>
          </div>
          <div className={`crm-stat-card crm-stat-success ${hiddenMobileStats.includes('interested') ? 'crm-stat-mobile-hidden' : ''}`}>
            <div className="crm-stat-icon"><Star size={22} /></div>
            <div className="crm-stat-body">
              <span className="crm-stat-value">{stats.interested}</span>
              <span className="crm-stat-label">Interested</span>
            </div>
          </div>
          <div className={`crm-stat-card crm-stat-warning ${hiddenMobileStats.includes('converted') ? 'crm-stat-mobile-hidden' : ''}`}>
            <div className="crm-stat-icon"><CheckCircle2 size={22} /></div>
            <div className="crm-stat-body">
              <span className="crm-stat-value">{stats.converted}</span>
              <span className="crm-stat-label">Converted</span>
            </div>
          </div>
          <div className={`crm-stat-card crm-stat-info ${hiddenMobileStats.includes('today') ? 'crm-stat-mobile-hidden' : ''}`}>
            <div className="crm-stat-icon"><Clock size={22} /></div>
            <div className="crm-stat-body">
              <span className="crm-stat-value">{stats.todayCount}</span>
              <span className="crm-stat-label">New Today</span>
            </div>
          </div>
          <div className={`crm-stat-card crm-stat-funds ${hiddenMobileStats.includes('funds') ? 'crm-stat-mobile-hidden' : ''}`}>
            <div className="crm-stat-icon"><DollarSign size={22} /></div>
            <div className="crm-stat-body">
              <span className="crm-stat-value">{formatFund(fundStats.total)}</span>
              <span className="crm-stat-label">Total Funds</span>
            </div>
          </div>
          <div className={`crm-stat-card crm-stat-setup ${hiddenMobileStats.includes('setup') ? 'crm-stat-mobile-hidden' : ''}`}>
            <div className="crm-stat-icon"><DollarSign size={22} /></div>
            <div className="crm-stat-body">
              <span className="crm-stat-value">{formatFund(stats.setupCost)}</span>
              <span className="crm-stat-label">Setup Cost</span>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && <div className="crm-error-banner">{error}</div>}

        {/* Loading */}
        {loading ? (
          <div className="crm-table-card">
            <div className="crm-loading-state">
              <Loader2 size={32} className="crm-spin" />
              <p>Loading leads...</p>
            </div>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="crm-table-card">
            <div className="crm-empty-state">
              <Users size={48} />
              <h3>No leads found</h3>
              <p>{leads.length === 0 ? 'No submissions yet. Once visitors fill the form, their details will appear here.' : 'No leads match your current filters. Try adjusting your search or status filter.'}</p>
            </div>
          </div>
        ) : mobileNav === 'pipeline' || viewMode === 'pipeline' ? (
          <PipelineView leads={filteredLeads} onLeadClick={setSelectedLead} onStatusChange={updateLead} formatDate={formatDate} assigneeMap={assigneeMap} stages={pipelineStages} />
        ) : (
          <div className="crm-content-wrapper">
          {/* Desktop Table View */}
          <div className="crm-table-card crm-desktop-table">
            {selectedIds.size > 0 && (
              <div className="crm-bulk-action-bar">
                <div className="crm-bulk-bar-left">
                  <button className="crm-bulk-clear" onClick={clearSelection} aria-label="Clear selection">
                    <X size={16} />
                  </button>
                  <span className="crm-bulk-count">
                    {selectedIds.size} lead{selectedIds.size !== 1 ? 's' : ''} selected
                  </span>
                </div>
                <div className="crm-bulk-bar-right">
                  {selectedIds.size < filteredLeads.length && (
                    <button
                      onClick={selectAllLeads}
                      disabled={bulkDeleting}
                      className="crm-bulk-btn crm-bulk-btn-select"
                    >
                      <CheckSquare size={15} /> Select All ({filteredLeads.length})
                    </button>
                  )}
                  <button className="crm-bulk-clear-btn" onClick={clearSelection} disabled={bulkDeleting}>
                    Clear
                  </button>
                  <div className="crm-bulk-divider" />
                  <button
                    onClick={() => setShowBulkEmail(true)}
                    className="crm-bulk-btn crm-bulk-btn-email"
                  >
                    <Send size={15} /> Bulk Email
                  </button>
                  {permissions.broadcasts && (
                    <button
                      onClick={() => { setShowBulkWa(true); setBulkWaTplName(''); setBulkWaTplComponents([]); setBulkWaResult(null); setBulkWaError(''); }}
                      className="crm-bulk-btn crm-bulk-btn-wa"
                    >
                      <MessageCircle size={15} /> Bulk WhatsApp
                    </button>
                  )}
                  <button
                    onClick={() => { setBulkAssignResult(null); setShowBulkAssign(true); }}
                    className="crm-bulk-btn"
                    style={{ border: '1px solid rgba(15,118,110,0.3)', background: 'rgba(15,118,110,0.06)', color: '#0f766e' }}
                  >
                    <Shuffle size={15} /> Bulk Assign
                  </button>
                  <button
                    onClick={() => { setBulkFundValue(''); setBulkFundResult(null); setShowBulkFund(true); }}
                    className="crm-bulk-btn crm-bulk-btn-fund"
                  >
                    <DollarSign size={15} /> Update Fund
                  </button>
                  <button
                    onClick={() => { setBulkStatusValue('interested'); setBulkStatusResult(null); setShowBulkStatus(true); }}
                    className="crm-bulk-btn crm-bulk-btn-status"
                  >
                    <RefreshCw size={15} /> Update Status
                  </button>
                  <button
                    className="crm-bulk-delete-btn"
                    onClick={() => setShowBulkDeleteConfirm(true)}
                    disabled={bulkDeleting || !permissions.deleteLeads}
                    style={{ display: permissions.deleteLeads ? '' : 'none' }}
                  >
                    <Trash2 size={15} /> Delete
                  </button>
                </div>
              </div>
            )}
            <div className="crm-table-toolbar">
              {isAgent && (
                <div className="crm-view-toggle" style={{ flexShrink: 0 }}>
                  <button className={viewMode2 === 'my' ? 'active' : ''} onClick={() => { setViewMode2('my'); setPage(0); }}>
                    <UserCheck size={16} /> My Leads
                  </button>
                  <button className={viewMode2 === 'all' ? 'active' : ''} onClick={() => { setViewMode2('all'); setPage(0); }}>
                    <Users size={16} /> All Leads
                  </button>
                </div>
              )}
              <div className="crm-search-wrap">
                <Search size={18} />
                <input type="text" placeholder="Search by name, email, phone, state, or tags..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                />
              </div>
              <div className="crm-filter-wrap">
                <Filter size={16} />
                <select value={productFilter}
                  onChange={(e) => { setProductFilter(e.target.value as typeof productFilter); setPage(0); }}
                >
                  <option value="all">All Products</option>
                  <option value="algo">Trading Algo</option>
                  <option value="tradingview_premium">TradingView Premium</option>
                </select>
              </div>
              <div className="crm-filter-wrap">
                <select value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); setPage(0); }}
                >
                  <option value="all">All Statuses</option>
                  {pipelineStages.map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="crm-date-filter-wrap">
                <Calendar size={16} className="crm-date-filter-icon" />
                <select
                  value={dateFilter}
                  onChange={(e) => { setDateFilter(e.target.value as DateFilterPreset); setPage(0); }}
                  className="crm-date-filter-select"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="last_7_days">Last 7 Days</option>
                  <option value="this_week">This Week</option>
                  <option value="this_month">This Month</option>
                  <option value="this_year">This Year</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>
              {dateFilter === 'custom' && (
                <div className="crm-custom-date-wrap">
                  <input
                    type="date"
                    value={customDateStart}
                    onChange={(e) => { setCustomDateStart(e.target.value); setPage(0); }}
                    className="crm-custom-date-input"
                    placeholder="Start"
                  />
                  <span className="crm-custom-date-sep">to</span>
                  <input
                    type="date"
                    value={customDateEnd}
                    onChange={(e) => { setCustomDateEnd(e.target.value); setPage(0); }}
                    className="crm-custom-date-input"
                    placeholder="End"
                  />
                </div>
              )}
              <button
                onClick={() => { setDupesOnly((v) => !v); setPage(0); }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', border: dupesOnly ? '1px solid rgba(245,158,11,0.4)' : '1px solid var(--border-subtle)', borderRadius: '8px', background: dupesOnly ? 'rgba(245,158,11,0.08)' : 'var(--bg-card)', color: dupesOnly ? '#d97706' : 'var(--text-dark)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' }}
              >
                <AlertTriangle size={15} /> {dupesOnly ? 'Duplicates Only' : 'Duplicates'}
              </button>
              {duplicateLeadIds.size > 0 && (
                <button
                  onClick={() => setShowBulkMerge(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', border: '1px solid rgba(16,163,74,0.3)', borderRadius: '8px', background: 'rgba(16,163,74,0.06)', color: '#16a34a', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#16a34a'; e.currentTarget.style.color = '#fff'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(16,163,74,0.06)'; e.currentTarget.style.color = '#16a34a'; }}
                >
                  <GitMerge size={15} /> Merge All ({Math.ceil(duplicateLeadIds.size / 2)})
                </button>
              )}
              {permissions.deleteLeads && (
                <button
                  onClick={() => { setShowFilterDeleteModal(true); setFilterDeleteResult(null); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', border: '1px solid var(--border-subtle)', borderRadius: '8px', background: 'var(--bg-card)', color: '#dc2626', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#dc2626'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#dc2626'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                >
                  <Filter size={15} /> Delete by Filter
                </button>
              )}
            </div>

            <div className="crm-table-scroll">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th className="crm-th-checkbox">
                      <label className="crm-checkbox-wrap">
                        <input
                          type="checkbox"
                          checked={allPageSelected}
                          ref={(el) => { if (el) el.indeterminate = somePageSelected; }}
                          onChange={toggleSelectAll}
                        />
                        <span className="crm-checkbox-box" />
                      </label>
                    </th>
                    <th className="crm-th-sortable" onClick={() => handleSort('full_name')}>
                      <div className="crm-th-inner">Lead
                        <span className={`crm-sort-arrow ${sortKey === 'full_name' ? `active ${sortDir}` : ''}`}>
                          {sortKey === 'full_name' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                        </span>
                      </div>
                    </th>
                    <th>Contact</th>
                    <th>Status</th>
                    <th>Assigned</th>
                    <th>Tags</th>
                    <th>Source</th>
                    <th className="crm-th-sortable" onClick={() => handleSort('trading_product')}>
                      <div className="crm-th-inner">Product
                        <span className={`crm-sort-arrow ${sortKey === 'trading_product' ? `active ${sortDir}` : ''}`}>
                          {sortKey === 'trading_product' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                        </span>
                      </div>
                    </th>
                    <th>Fund</th>
                    <th className="crm-th-sortable" onClick={() => handleSort('created_at')}>
                      <div className="crm-th-inner"><Calendar size={14} /> Submitted
                        <span className={`crm-sort-arrow ${sortKey === 'created_at' ? `active ${sortDir}` : ''}`}>
                          {sortKey === 'created_at' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                        </span>
                      </div>
                    </th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedLeads.map((lead) => {
                    const stage = pipelineStages.find((s) => s.key === lead.status)!;
                    const colors = STAGE_COLORS[stage.color];
                    return (
                      <tr key={lead.id} className={`crm-table-row ${selectedIds.has(lead.id) ? 'crm-row-selected' : ''}`} onClick={() => setSelectedLead(lead)} style={{ cursor: 'pointer' }}>
                        <td className="crm-td-checkbox" onClick={(e) => e.stopPropagation()}>
                          <label className="crm-checkbox-wrap">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(lead.id)}
                              onChange={() => toggleSelect(lead.id)}
                            />
                            <span className="crm-checkbox-box" />
                          </label>
                        </td>
                        <td>
                          <div className="crm-lead-cell">
                            <div className="crm-lead-avatar">
                              {lead.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                            </div>
                            <div className="crm-lead-info">
                              <strong>{lead.full_name}</strong>
                              <span>{lead.email}</span>
                            </div>
                            {duplicateLeadIds.has(lead.id) && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.66rem', fontWeight: 700, color: '#d97706', background: 'rgba(245,158,11,0.12)', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px', whiteSpace: 'nowrap' }}>
                                <AlertTriangle size={10} /> DUP
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="crm-contact-cell">
                            <button type="button" className="crm-contact-item" onClick={(e) => { e.stopPropagation(); window.location.href = `tel:${lead.mobile_number.replace(/[^+\d]/g, '')}`; }} style={{ cursor: 'pointer', font: 'inherit' }}>
                              <Phone size={14} /> {lead.mobile_number}
                            </button>
                            <span className="crm-contact-item crm-contact-email">
                              <MapPin size={13} /> {lead.state}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className="crm-status-badge" style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}>
                            {stage.icon} {stage.label}
                          </span>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <select
                            value={lead.assigned_to || ''}
                            onChange={(e) => updateLead(lead.id, { assigned_to: e.target.value || null })}
                            aria-label={`Assign ${lead.full_name}`}
                            style={{
                              border: lead.assigned_to ? '1px solid rgba(15,118,110,0.2)' : '1px solid var(--border-subtle)',
                              background: lead.assigned_to ? 'rgba(15,118,110,0.06)' : 'var(--bg-card)',
                              color: lead.assigned_to ? '#0f766e' : 'var(--text-dark)',
                              borderRadius: '6px',
                              padding: '4px 8px',
                              fontSize: '0.76rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              outline: 'none',
                              maxWidth: '130px',
                            }}
                          >
                            <option value="">Unassigned</option>
                            {Object.entries(assigneeMap).map(([id, name]) => (
                              <option key={id} value={id}>{name}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <div className="crm-tags-cell">
                            {(lead.tags || []).slice(0, 3).map((t) => (
                              <span key={t} className="crm-tag-mini">{t}</span>
                            ))}
                            {(lead.tags || []).length > 3 && <span className="crm-tag-more">+{lead.tags.length - 3}</span>}
                            {(lead.tags || []).length === 0 && <span className="crm-tag-empty">No tags</span>}
                          </div>
                        </td>
                        <td>
                          <LeadSourceBadge source={lead.lead_source} size={16} />
                        </td>
                        <td>
                          <span className={`crm-product-tag ${lead.trading_product}`}>
                            {lead.trading_product === 'algo' ? <><Bot size={13} /> Algo</> : <><BarChart3 size={13} /> TV Premium</>}
                          </span>
                        </td>
                        <td>
                          {lead.fund_amount != null ? (
                            <span style={{ fontWeight: 700, color: lead.fund_amount >= 500 ? '#16a34a' : '#ef4444' }}>
                              ${lead.fund_amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-dark)', fontSize: '0.82rem' }}>—</span>
                          )}
                        </td>
                        <td><span className="crm-date-tag">{formatDate(lead.created_at)}</span></td>
                        <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'right' }}>
                          {duplicateLeadIds.has(lead.id) && (
                            <button
                              onClick={() => setMergeTarget(lead)}
                              aria-label={`Merge ${lead.full_name}`}
                              title="Merge duplicate"
                              style={{ border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.08)', color: '#d97706', borderRadius: '8px', padding: '7px 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.8rem', transition: 'all 0.15s', marginRight: '6px' }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = '#d97706'; e.currentTarget.style.color = '#fff'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(245,158,11,0.08)'; e.currentTarget.style.color = '#d97706'; }}
                            >
                              <GitMerge size={14} /> Merge
                            </button>
                          )}
                          <button
                            className="crm-row-email-btn"
                            onClick={() => setEmailTarget(lead)}
                            aria-label={`Email ${lead.full_name}`}
                            title="Send Email"
                            style={{ border: 'none', background: 'rgba(37,99,235,0.1)', color: '#2563eb', borderRadius: '8px', padding: '7px 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.8rem', transition: 'all 0.15s', marginRight: '6px' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#2563eb'; e.currentTarget.style.color = '#fff'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(37,99,235,0.1)'; e.currentTarget.style.color = '#2563eb'; }}
                          >
                            <Send size={14} /> Email
                          </button>
                          <button
                            className="lead-wa-row-btn"
                            onClick={(e) => { e.stopPropagation(); setWaDrawerLead(lead); }}
                            disabled={!lead.mobile_number}
                            title={lead.mobile_number ? 'WhatsApp Quick-Chat' : 'No phone number'}
                            aria-label={`WhatsApp ${lead.full_name}`}
                          >
                            <MessageCircle size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="crm-pagination">
              <span className="crm-pagination-info">
                Showing {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, filteredLeads.length)} of {filteredLeads.length} leads
              </span>
              <div className="crm-pagination-controls">
                <button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className="crm-page-btn">
                  <ChevronLeft size={18} /> Prev
                </button>
                <span className="crm-page-num">Page {currentPage + 1} / {totalPages}</span>
                <button disabled={currentPage >= totalPages - 1} onClick={() => setPage(currentPage + 1)} className="crm-page-btn">
                  Next <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Card List View */}
          <div className="crm-mobile-leads">
            {/* Mobile Search Bar */}
            <div className="crm-mobile-search-bar">
              <div className="crm-mobile-search-wrap">
                <Search size={18} />
                <input type="text" placeholder="Search leads..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                />
              </div>
              <button className="crm-mobile-filter-btn" onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}>
                <SlidersHorizontal size={18} />
                <span>Filters</span>
                {(productFilter !== 'all' || statusFilter !== 'all' || dateFilter !== 'all' || dupesOnly) && <span className="crm-mobile-filter-dot" />}
              </button>
            </div>

            {/* Mobile Filter Panel */}
            {mobileFiltersOpen && (
              <div className="crm-mobile-filter-panel">
                <div className="crm-mobile-filter-group">
                  <label>Product</label>
                  <select value={productFilter}
                    onChange={(e) => { setProductFilter(e.target.value as typeof productFilter); setPage(0); }}
                  >
                    <option value="all">All Products</option>
                    <option value="algo">Trading Algo</option>
                    <option value="tradingview_premium">TradingView Premium</option>
                  </select>
                </div>
                <div className="crm-mobile-filter-group">
                  <label>Status</label>
                  <select value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); setPage(0); }}
                  >
                    <option value="all">All Statuses</option>
                    {pipelineStages.map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div className="crm-mobile-filter-group">
                  <label>Date</label>
                  <select
                    value={dateFilter}
                    onChange={(e) => { setDateFilter(e.target.value as DateFilterPreset); setPage(0); }}
                  >
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="last_7_days">Last 7 Days</option>
                    <option value="this_week">This Week</option>
                    <option value="this_month">This Month</option>
                    <option value="this_year">This Year</option>
                    <option value="custom">Custom Range</option>
                  </select>
                </div>
                {dateFilter === 'custom' && (
                  <div className="crm-mobile-filter-group crm-mobile-filter-dates">
                    <input type="date" value={customDateStart} onChange={(e) => { setCustomDateStart(e.target.value); setPage(0); }} placeholder="Start" />
                    <span>to</span>
                    <input type="date" value={customDateEnd} onChange={(e) => { setCustomDateEnd(e.target.value); setPage(0); }} placeholder="End" />
                  </div>
                )}
                <div className="crm-mobile-filter-group">
                  <label>Duplicates</label>
                  <button
                    onClick={() => { setDupesOnly((v) => !v); setPage(0); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', padding: '9px 12px', border: dupesOnly ? '1px solid rgba(245,158,11,0.4)' : '1px solid var(--border-subtle)', borderRadius: '8px', background: dupesOnly ? 'rgba(245,158,11,0.08)' : 'var(--bg-card)', color: dupesOnly ? '#d97706' : 'var(--text-dark)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
                  >
                    <AlertTriangle size={15} /> {dupesOnly ? 'Showing duplicates only' : 'Show duplicates only'}
                  </button>
                </div>
                {duplicateLeadIds.size > 0 && (
                  <button
                    onClick={() => setShowBulkMerge(true)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', padding: '10px 12px', border: '1px solid rgba(16,163,74,0.3)', borderRadius: '8px', background: 'rgba(16,163,74,0.06)', color: '#16a34a', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
                  >
                    <GitMerge size={15} /> Merge All Duplicates
                  </button>
                )}
                <button className="crm-mobile-filter-clear" onClick={() => { setProductFilter('all'); setStatusFilter('all'); setDateFilter('all'); setCustomDateStart(''); setCustomDateEnd(''); setDupesOnly(false); }}>
                  Clear All Filters
                </button>
              </div>
            )}

            {/* Mobile Delete Tools */}
            {permissions.deleteLeads && (
              <div style={{ display: 'flex', gap: '8px', padding: '0 16px 12px' }}>
                <button
                  onClick={() => { setShowFilterDeleteModal(true); setFilterDeleteResult(null); }}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', border: '1px solid var(--border-subtle)', borderRadius: '8px', background: 'var(--bg-card)', color: '#dc2626', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  <Filter size={15} /> Delete by Filter
                </button>
              </div>
            )}

            {/* Mobile Bulk Action Bar */}
            {selectedIds.size > 0 && (
              <div className="crm-mobile-bulk-bar">
                <button className="crm-mobile-bulk-clear" onClick={clearSelection}>
                  <X size={18} />
                </button>
                <span>{selectedIds.size} selected</span>
                {selectedIds.size < filteredLeads.length && (
                  <button
                    onClick={selectAllLeads}
                    disabled={bulkDeleting}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '4px',
                      border: '1px solid rgba(37,99,235,0.3)', borderRadius: '8px',
                      background: 'rgba(37,99,235,0.05)', color: '#2563eb',
                      fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', padding: '6px 10px',
                    }}
                  >
                    <CheckSquare size={15} /> All ({filteredLeads.length})
                  </button>
                )}
                <button
                  onClick={() => { setBulkStatusValue('interested'); setBulkStatusResult(null); setShowBulkStatus(true); }}
                  disabled={bulkStatusUpdating}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid rgba(16,163,74,0.3)', borderRadius: '8px', background: 'rgba(16,163,74,0.06)', color: '#16a34a', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', padding: '6px 10px' }}
                >
                  <RefreshCw size={15} /> Status
                </button>
                <button
                  onClick={() => { setBulkAssignValue(''); setBulkAssignResult(null); setShowBulkAssign(true); }}
                  disabled={bulkAssignUpdating}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid rgba(15,118,110,0.3)', borderRadius: '8px', background: 'rgba(15,118,110,0.06)', color: '#0f766e', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', padding: '6px 10px' }}
                >
                  <Shuffle size={15} /> Assign
                </button>
                <button
                  onClick={() => { setBulkFundValue(''); setBulkFundResult(null); setShowBulkFund(true); }}
                  disabled={bulkFundUpdating}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid rgba(234,179,8,0.3)', borderRadius: '8px', background: 'rgba(234,179,8,0.06)', color: '#854d0e', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', padding: '6px 10px' }}
                >
                  <DollarSign size={15} /> Fund
                </button>
                <button className="crm-mobile-bulk-delete" onClick={() => setShowBulkDeleteConfirm(true)} disabled={bulkDeleting}>
                  <Trash2 size={16} /> Delete
                </button>
              </div>
            )}

            {/* Mobile Lead Cards */}
            <div className="crm-mobile-card-list">
              {pagedLeads.map((lead) => {
                const stage = pipelineStages.find((s) => s.key === lead.status)!;
                const colors = STAGE_COLORS[stage.color];
                return (
                  <div
                    key={lead.id}
                    className={`crm-mobile-lead-card ${selectedIds.has(lead.id) ? 'selected' : ''}`}
                    onClick={() => setSelectedLead(lead)}
                  >
                    <div className="crm-mobile-card-header">
                      <label className="crm-checkbox-wrap crm-mobile-checkbox" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.has(lead.id)} onChange={() => toggleSelect(lead.id)} />
                        <span className="crm-checkbox-box" />
                      </label>
                      <div className="crm-lead-avatar crm-mobile-avatar">
                        {lead.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                      <div className="crm-mobile-card-info">
                        <strong>{lead.full_name}</strong>
                        <span>{lead.email}</span>
                      </div>
                      {duplicateLeadIds.has(lead.id) && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.62rem', fontWeight: 700, color: '#d97706', background: 'rgba(245,158,11,0.12)', padding: '2px 5px', borderRadius: '4px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          <AlertTriangle size={9} /> DUP
                        </span>
                      )}
                      <span className="crm-status-badge crm-mobile-status-badge" style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}>
                        {stage.icon}
                      </span>
                    </div>
                    <div className="crm-mobile-card-body">
                      <button type="button" className="crm-mobile-card-phone" onClick={(e) => { e.stopPropagation(); window.location.href = `tel:${lead.mobile_number.replace(/[^+\d]/g, '')}`; }} style={{ cursor: 'pointer', font: 'inherit' }}>
                        <Phone size={14} /> {lead.mobile_number}
                      </button>
                      <span className="crm-mobile-card-location">
                        <MapPin size={13} /> {lead.state}
                      </span>
                    </div>
                    <div className="crm-mobile-card-footer">
                      <span className={`crm-product-tag ${lead.trading_product}`}>
                        {lead.trading_product === 'algo' ? <><Bot size={12} /> Algo</> : <><BarChart3 size={12} /> TV Premium</>}
                      </span>
                      {lead.assigned_to && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 600, color: '#0f766e' }}>
                          <Shuffle size={11} /> {assigneeMap[lead.assigned_to]?.split('@')[0] || 'Assigned'}
                        </span>
                      )}
                      {lead.fund_amount != null && (
                        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: lead.fund_amount >= 500 ? '#16a34a' : '#ef4444' }}>
                          ${lead.fund_amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        </span>
                      )}
                      {(lead.tags || []).length > 0 && (
                        <div className="crm-mobile-card-tags">
                          {lead.tags.slice(0, 2).map((t) => (
                            <span key={t} className="crm-tag-mini">{t}</span>
                          ))}
                          {lead.tags.length > 2 && <span className="crm-tag-more">+{lead.tags.length - 2}</span>}
                        </div>
                      )}
                      {duplicateLeadIds.has(lead.id) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setMergeTarget(lead); }}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 600, color: '#d97706', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', flexShrink: 0 }}
                        >
                          <GitMerge size={13} /> Merge
                        </button>
                      )}
                      <button
                        className="lead-wa-row-btn"
                        onClick={(e) => { e.stopPropagation(); setWaDrawerLead(lead); }}
                        disabled={!lead.mobile_number}
                        title={lead.mobile_number ? 'WhatsApp Quick-Chat' : 'No phone number'}
                        aria-label={`WhatsApp ${lead.full_name}`}
                      >
                        <MessageCircle size={16} />
                      </button>
                      <span className="crm-mobile-card-date">{formatDate(lead.created_at)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile Pagination */}
            <div className="crm-mobile-pagination">
              <button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className="crm-mobile-page-btn">
                <ChevronLeft size={18} />
              </button>
              <span className="crm-mobile-page-info">{currentPage + 1} / {totalPages}</span>
              <button disabled={currentPage >= totalPages - 1} onClick={() => setPage(currentPage + 1)} className="crm-mobile-page-btn">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
          </div>
        )}
        </>
      )}
      </main>

      <LeadWhatsAppDrawer
        open={!!waDrawerLead}
        lead={waDrawerLead ? { id: waDrawerLead.id, full_name: waDrawerLead.full_name, email: waDrawerLead.email, mobile_number: waDrawerLead.mobile_number } : null}
        session={session}
        onClose={() => setWaDrawerLead(null)}
      />

      {selectedLead && (
        <LeadDetailDrawer
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={updateLead}
          onDelete={deleteLead}
          formatDate={formatDate}
          onSendEmail={(lead) => setEmailTarget(lead)}
          onCall={(number) => { window.location.href = `tel:${number.replace(/[^+\d]/g, '')}`; }}
          setupCostPerClient={setupCostPerClient}
          stages={pipelineStages}
        />
      )}

      {showAddLead && (
        <AddLeadModal
          onClose={() => setShowAddLead(false)}
          onAdd={addLead}
          onMerge={mergeLead}
          existingLeads={leads}
          stages={pipelineStages}
        />
      )}

      {showBulkUpload && (
        <BulkUploadModal
          onClose={() => setShowBulkUpload(false)}
          onUpload={bulkUploadLeads}
        />
      )}

      {emailTarget && (
        <EmailComposeModal
          lead={emailTarget}
          session={session}
          onClose={() => setEmailTarget(null)}
        />
      )}

      {showBulkFund && (
        <>
          <div className="crm-drawer-overlay" onClick={() => !bulkFundUpdating && setShowBulkFund(false)} />
          <div className="crm-bulk-delete-modal" style={{ maxWidth: '440px' }}>
            <div className="crm-bulk-delete-icon" style={{ background: 'rgba(234,179,8,0.12)', color: '#854d0e' }}>
              <DollarSign size={32} />
            </div>
            <h3>Update Fund Amount for {selectedIds.size} Lead{selectedIds.size !== 1 ? 's' : ''}</h3>
            {bulkFundResult !== null ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <CheckCircle2 size={40} style={{ color: '#16a34a', marginBottom: '8px' }} />
                <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#16a34a' }}>
                  {bulkFundResult} lead{bulkFundResult !== 1 ? 's' : ''} updated successfully.
                </p>
                <button className="crm-delete-cancel" style={{ marginTop: '16px' }} onClick={() => { setShowBulkFund(false); clearSelection(); }}>
                  Done
                </button>
              </div>
            ) : (
              <>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-dark)', marginBottom: '16px' }}>
                  Enter a fund amount to apply to all selected leads. Enter 0 to clear the fund amount.
                </p>
                <div style={{ position: 'relative', marginBottom: '16px' }}>
                  <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '1rem', fontWeight: 700, color: '#854d0e' }}>$</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={bulkFundValue}
                    onChange={(e) => setBulkFundValue(e.target.value)}
                    placeholder="Enter fund amount"
                    style={{ width: '100%', padding: '10px 14px 10px 32px', border: '1px solid var(--border-subtle)', borderRadius: '8px', fontSize: '0.85rem' }}
                  />
                </div>
                <div className="crm-bulk-delete-actions">
                  <button className="crm-delete-cancel" onClick={() => setShowBulkFund(false)} disabled={bulkFundUpdating}>
                    Cancel
                  </button>
                  <button
                    className="crm-add-lead-submit"
                    disabled={bulkFundUpdating || bulkFundValue === ''}
                    onClick={async () => {
                      const amount = parseFloat(bulkFundValue) || 0;
                      const count = await bulkUpdateFund(Array.from(selectedIds), amount);
                      setBulkFundResult(count);
                    }}
                    style={{ background: '#854d0e' }}
                  >
                    {bulkFundUpdating ? <Loader2 size={16} className="crm-spin" /> : <DollarSign size={16} />}
                    {bulkFundUpdating ? 'Updating...' : 'Update Fund'}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {showBulkAssign && (
        <>
          <div className="crm-drawer-overlay" onClick={() => !bulkAssignUpdating && setShowBulkAssign(false)} />
          <div className="crm-bulk-delete-modal" style={{ maxWidth: '440px' }}>
            <div className="crm-bulk-delete-icon" style={{ background: 'rgba(15,118,110,0.1)', color: '#0f766e' }}>
              <Shuffle size={32} />
            </div>
            <h3>Assign {selectedIds.size} Lead{selectedIds.size !== 1 ? 's' : ''}</h3>
            {bulkAssignResult !== null ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <CheckCircle2 size={40} style={{ color: '#16a34a', marginBottom: '8px' }} />
                <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#16a34a' }}>
                  {bulkAssignResult} lead{bulkAssignResult !== 1 ? 's' : ''} assigned successfully.
                </p>
                <button className="crm-delete-cancel" style={{ marginTop: '16px' }} onClick={() => { setShowBulkAssign(false); clearSelection(); }}>
                  Done
                </button>
              </div>
            ) : (
              <>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-dark)', marginBottom: '16px' }}>
                  Select a team member to assign all selected leads. Choose "Unassigned" to remove assignment.
                </p>
                <select
                  value={bulkAssignValue}
                  onChange={(e) => setBulkAssignValue(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border-subtle)', borderRadius: '8px', fontSize: '0.85rem', cursor: 'pointer', marginBottom: '16px' }}
                >
                  <option value="">Unassigned</option>
                  {Object.entries(assigneeMap).map(([id, name]) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
                </select>
                <div className="crm-bulk-delete-actions">
                  <button className="crm-delete-cancel" onClick={() => setShowBulkAssign(false)} disabled={bulkAssignUpdating}>
                    Cancel
                  </button>
                  <button
                    className="crm-add-lead-submit"
                    disabled={bulkAssignUpdating}
                    onClick={async () => {
                      const count = await bulkAssignLeads(Array.from(selectedIds), bulkAssignValue);
                      setBulkAssignResult(count);
                    }}
                    style={{ background: '#0f766e' }}
                  >
                    {bulkAssignUpdating ? <Loader2 size={16} className="crm-spin" /> : <Shuffle size={16} />}
                    {bulkAssignUpdating ? 'Assigning...' : 'Assign Leads'}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {showBulkStatus && (
        <>
          <div className="crm-drawer-overlay" onClick={() => !bulkStatusUpdating && setShowBulkStatus(false)} />
          <div className="crm-bulk-delete-modal" style={{ maxWidth: '440px' }}>
            <div className="crm-bulk-delete-icon" style={{ background: 'rgba(16,163,74,0.1)', color: '#16a34a' }}>
              <RefreshCw size={32} />
            </div>
            <h3>Update Status for {selectedIds.size} Lead{selectedIds.size !== 1 ? 's' : ''}</h3>
            {bulkStatusResult !== null ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <CheckCircle2 size={40} style={{ color: '#16a34a', marginBottom: '8px' }} />
                <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#16a34a' }}>
                  {bulkStatusResult} lead{bulkStatusResult !== 1 ? 's' : ''} updated successfully.
                </p>
                <button className="crm-delete-cancel" style={{ marginTop: '16px' }} onClick={() => { setShowBulkStatus(false); clearSelection(); }}>
                  Done
                </button>
              </div>
            ) : (
              <>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-dark)', marginBottom: '16px' }}>
                  Select a new status for all selected leads. This will update their pipeline stage and fire automation triggers.
                </p>
                <select
                  value={bulkStatusValue}
                  onChange={(e) => setBulkStatusValue(e.target.value as LeadStatus)}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border-subtle)', borderRadius: '8px', fontSize: '0.85rem', cursor: 'pointer', marginBottom: '16px' }}
                >
                  {pipelineStages.map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
                <div className="crm-bulk-delete-actions">
                  <button className="crm-delete-cancel" onClick={() => setShowBulkStatus(false)} disabled={bulkStatusUpdating}>
                    Cancel
                  </button>
                  <button
                    className="crm-add-lead-submit"
                    disabled={bulkStatusUpdating}
                    onClick={async () => {
                      const count = await bulkUpdateStatus(Array.from(selectedIds), bulkStatusValue);
                      setBulkStatusResult(count);
                    }}
                    style={{ background: '#16a34a' }}
                  >
                    {bulkStatusUpdating ? <Loader2 size={16} className="crm-spin" /> : <RefreshCw size={16} />}
                    {bulkStatusUpdating ? 'Updating...' : 'Update Status'}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {showBulkWa && (
        <>
          <div className="crm-drawer-overlay" onClick={() => !bulkWaSending && setShowBulkWa(false)} />
          <div className="crm-bulk-delete-modal" style={{ maxWidth: '560px' }}>
            <div className="crm-bulk-delete-icon" style={{ background: 'rgba(18,140,126,0.1)', color: '#075e54' }}>
              <MessageCircle size={32} />
            </div>
            <h3>WhatsApp Broadcast — {selectedIds.size} Lead{selectedIds.size !== 1 ? 's' : ''}</h3>
            {bulkWaResult ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <CheckCircle2 size={40} style={{ color: bulkWaResult.failed > 0 ? '#f59e0b' : '#16a34a', marginBottom: '8px' }} />
                <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#16a34a', margin: '0 0 4px' }}>
                  Broadcast created successfully!
                </p>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-dark)', margin: '0 0 16px' }}>
                  {bulkWaResult.sent} sent · {bulkWaResult.failed} failed · {bulkWaResult.total} total recipients
                </p>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-dark)', margin: '0 0 16px' }}>
                  Go to Broadcasts to start sending the campaign.
                </p>
                <button className="crm-delete-cancel" onClick={() => { setShowBulkWa(false); clearSelection(); }}>
                  Done
                </button>
              </div>
            ) : (
              <>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-dark)', margin: '0 0 16px' }}>
                  Select an approved WhatsApp template to send to the selected leads.
                </p>

                <div style={{ maxHeight: '280px', overflowY: 'auto', margin: '0 0 12px', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '6px' }}>
                  {bulkWaTemplatesLoading ? (
                    <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-dark)', fontSize: '0.82rem' }}>
                      <Loader2 size={24} className="crm-spin" style={{ marginBottom: '8px' }} />
                      <p>Loading templates...</p>
                    </div>
                  ) : bulkWaTemplates.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-dark)', fontSize: '0.82rem' }}>
                      <MessageCircle size={28} style={{ marginBottom: '8px', opacity: 0.3 }} />
                      <p>No approved templates found. Create and approve templates first in the Templates page.</p>
                    </div>
                  ) : (
                    bulkWaTemplates.map((tpl) => {
                      const bodyComp = tpl.components?.find((c) => (c as Record<string, unknown>).type === 'BODY') as Record<string, unknown> | undefined;
                      const bodyText = (bodyComp?.text as string) || '';
                      const isSelected = bulkWaTplName === tpl.name;
                      return (
                        <div
                          key={tpl.meta_template_id || tpl.name}
                          onClick={() => { setBulkWaTplName(tpl.name); setBulkWaTplLanguage(tpl.language); setBulkWaTplComponents(tpl.components || []); setBulkWaError(''); }}
                          style={{
                            display: 'flex', flexDirection: 'column', gap: '4px',
                            padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
                            border: isSelected ? '2px solid #128c7e' : '1px solid #f0f2f5',
                            background: isSelected ? 'rgba(18,140,126,0.06)' : 'var(--bg-card)',
                            marginBottom: '4px', transition: 'all 0.15s',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                            <strong style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>{tpl.name}</strong>
                            <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#16a34a', background: 'rgba(22,163,74,0.1)', padding: '2px 8px', borderRadius: '100px' }}>
                              {tpl.category}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-dark)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            {bodyText || 'No body text'}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-dark)' }}>{tpl.language}</span>
                        </div>
                      );
                    })
                  )}
                </div>

                {bulkWaError && (
                  <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', color: '#dc2626', fontSize: '0.78rem', marginBottom: '12px' }}>
                    {bulkWaError}
                  </div>
                )}

                <div style={{ maxHeight: '120px', overflowY: 'auto', margin: '0 0 12px', padding: '8px 12px', background: 'var(--bg-light)', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '0.76rem' }}>
                  {leads.filter((l) => selectedIds.has(l.id) && l.mobile_number?.trim()).slice(0, 30).map((l) => (
                    <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 0', color: 'var(--text-muted)' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#128c7e', flexShrink: 0 }} />
                      <strong>{l.full_name}</strong>
                      <span style={{ color: 'var(--text-dark)' }}>— {l.mobile_number}</span>
                    </div>
                  ))}
                  {leads.filter((l) => selectedIds.has(l.id) && l.mobile_number?.trim()).length === 0 && (
                    <div style={{ textAlign: 'center', padding: '12px', color: '#dc2626', fontSize: '0.78rem' }}>
                      No selected leads have a valid phone number.
                    </div>
                  )}
                  {leads.filter((l) => selectedIds.has(l.id) && l.mobile_number?.trim()).length > 30 && (
                    <div style={{ textAlign: 'center', padding: '4px', color: 'var(--text-dark)', fontSize: '0.72rem' }}>
                      ...and {leads.filter((l) => selectedIds.has(l.id) && l.mobile_number?.trim()).length - 30} more
                    </div>
                  )}
                </div>

                <div className="crm-bulk-delete-actions">
                  <button className="crm-delete-cancel" onClick={() => setShowBulkWa(false)} disabled={bulkWaSending}>
                    Cancel
                  </button>
                  <button
                    className="crm-delete-confirm-btn"
                    style={{ background: bulkWaSending ? '#94a3b8' : '#128c7e' }}
                    onClick={async () => {
                      if (!bulkWaTplName) { setBulkWaError('Please select a template.'); return; }
                      const selectedLeads = leads.filter((l) => selectedIds.has(l.id) && l.mobile_number?.trim());
                      if (selectedLeads.length === 0) { setBulkWaError('No selected leads have a valid phone number.'); return; }
                      setBulkWaSending(true);
                      setBulkWaError('');
                      try {
                        const { data: sessionData } = await supabase.auth.getSession();
                        const token = sessionData.session?.access_token;
                        if (!token) { setBulkWaError('Session expired.'); setBulkWaSending(false); return; }
                        const recipients = selectedLeads.map((l) => ({ lead_id: l.id, phone_number: l.mobile_number.trim() }));
                        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-broadcast?action=create`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ template_name: bulkWaTplName, template_language: bulkWaTplLanguage, template_components: bulkWaTplComponents, recipients }),
                        });
                        const data = await res.json();
                        if (!res.ok || data.error) { setBulkWaError(data.error || 'Failed to create broadcast'); setBulkWaSending(false); return; }
                        setBulkWaResult({ sent: 0, failed: 0, total: recipients.length });
                      } catch {
                        setBulkWaError('Failed to create broadcast');
                      } finally {
                        setBulkWaSending(false);
                      }
                    }}
                    disabled={bulkWaSending || !bulkWaTplName}
                  >
                    {bulkWaSending ? <Loader2 size={16} className="crm-spin" /> : <Send size={16} />}
                    {bulkWaSending ? 'Creating...' : 'Send Broadcast'}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {showBulkEmail && (
        <BulkEmailModal
          leads={leads.filter((l) => selectedIds.has(l.id))}
          session={session}
          onClose={() => setShowBulkEmail(false)}
          onComplete={() => { setShowBulkEmail(false); clearSelection(); }}
        />
      )}

      {showDialer && (
        <DialerPanel
          onClose={() => { setShowDialer(false); setDialerCallInitiated(false); }}
          number={dialerNumber}
          setNumber={setDialerNumber}
          callInitiated={dialerCallInitiated}
          setCallInitiated={setDialerCallInitiated}
          session={session}
        />
      )}

      {/* Mobile Bottom Navigation */}
      <nav className="crm-mobile-bottom-nav">
        <button className={`crm-mobile-nav-item ${mobileNav === 'leads' ? 'active' : ''}`} onClick={() => setMobileNav('leads')}>
          <span className="crm-mobile-nav-icon"><Users size={20} /></span>
          <span className="crm-mobile-nav-label">Leads</span>
        </button>
        <button className={`crm-mobile-nav-item ${mobileNav === 'pipeline' ? 'active' : ''}`} onClick={() => setMobileNav('pipeline')}>
          <span className="crm-mobile-nav-icon"><LayoutGrid size={20} /></span>
          <span className="crm-mobile-nav-label">Pipeline</span>
        </button>
        {permissions.addLeads ? (
          <button className="crm-mobile-nav-fab" onClick={() => setShowAddLead(true)} aria-label="Add lead">
            <Plus size={22} />
          </button>
        ) : (
          <div className="crm-mobile-nav-fab-spacer" />
        )}
        {permissions.dialer && (
          <button className="crm-mobile-nav-item" onClick={() => setShowDialer(true)}>
            <span className="crm-mobile-nav-icon"><DialpadIcon size={20} /></span>
            <span className="crm-mobile-nav-label">Dialer</span>
          </button>
        )}
        {permissions.inbox && (
          <button
            className={`crm-mobile-nav-item ${activeView === 'inbox_hub' ? 'active' : ''}`}
            onClick={() => { navigateToView('inbox_hub'); setMobileSidebarOpen(false); setMobileNav('leads'); }}
          >
            <span className="crm-mobile-nav-icon">
              <MessageCircle size={20} />
              {waUnreadCount > 0 && <span className="crm-mobile-nav-badge">{waUnreadCount}</span>}
            </span>
            <span className="crm-mobile-nav-label">WhatsApp</span>
          </button>
        )}
        {permissions.bulkUpload && (
          <button className="crm-mobile-nav-item" onClick={() => setShowBulkUpload(true)}>
            <span className="crm-mobile-nav-icon"><Upload size={20} /></span>
            <span className="crm-mobile-nav-label">Upload</span>
          </button>
        )}
      </nav>

      {showBulkDeleteConfirm && (
        <>
          <div className="crm-drawer-overlay" onClick={() => !bulkDeleting && setShowBulkDeleteConfirm(false)} />
          <div className="crm-bulk-delete-modal">
            <div className="crm-bulk-delete-icon">
              <AlertTriangle size={32} />
            </div>
            <h3>Delete {selectedIds.size} lead{selectedIds.size !== 1 ? 's' : ''}?</h3>
            <p>These leads will be moved to the Recycle Bin. You can restore them within 30 days before they are permanently removed.</p>
            <div style={{ maxHeight: '160px', overflowY: 'auto', margin: '12px 0', padding: '8px 12px', background: 'var(--bg-light)', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '0.78rem' }}>
              {leads.filter((l) => selectedIds.has(l.id)).slice(0, 50).map((l) => (
                <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 0', color: 'var(--text-muted)' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#dc2626', flexShrink: 0 }} />
                  <strong>{l.full_name}</strong>
                  <span style={{ color: 'var(--text-dark)' }}>— {l.email}</span>
                </div>
              ))}
              {selectedIds.size > 50 && (
                <div style={{ textAlign: 'center', padding: '4px', color: 'var(--text-dark)', fontSize: '0.75rem' }}>
                  ...and {selectedIds.size - 50} more
                </div>
              )}
            </div>
            <div className="crm-bulk-delete-actions">
              <button
                className="crm-delete-cancel"
                onClick={() => setShowBulkDeleteConfirm(false)}
                disabled={bulkDeleting}
              >
                Cancel
              </button>
              <button
                className="crm-delete-confirm-btn"
                onClick={() => bulkDeleteLeads(Array.from(selectedIds))}
                disabled={bulkDeleting}
              >
                {bulkDeleting ? <Loader2 size={16} className="crm-spin" /> : <Trash2 size={16} />}
                {bulkDeleting ? 'Deleting...' : 'Yes, Delete All Selected'}
              </button>
            </div>
          </div>
        </>
      )}

      {showFilterDeleteModal && (
        <>
          <div className="crm-drawer-overlay" onClick={() => !filterDeleting && setShowFilterDeleteModal(false)} />
          <div className="crm-bulk-delete-modal" style={{ maxWidth: '480px' }}>
            <div className="crm-bulk-delete-icon" style={{ background: 'rgba(239,68,68,0.1)', color: '#dc2626' }}>
              <Filter size={32} />
            </div>
            <h3>Delete Leads by Filter</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-dark)' }}>Soft-delete all leads matching the criteria below. They will be moved to the Recycle Bin.</p>
            {filterDeleteResult !== null ? (
              <div style={{ textAlign: 'center', padding: '24px' }}>
                <CheckCircle2 size={40} style={{ color: '#16a34a', marginBottom: '8px' }} />
                <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#16a34a' }}>
                  {filterDeleteResult} lead{filterDeleteResult !== 1 ? 's' : ''} moved to Recycle Bin.
                </p>
                <button className="crm-delete-cancel" style={{ marginTop: '16px' }} onClick={() => { setShowFilterDeleteModal(false); setFilterDeleteResult(null); }}>
                  Done
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', margin: '16px 0' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>Status</span>
                    <select value={filterDeleteStatus} onChange={(e) => setFilterDeleteStatus(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--border-subtle)', borderRadius: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                      <option value="all">All statuses</option>
                      <option value="new">New</option>
                      <option value="called_no_response">Called - No Response</option>
                      <option value="called_responded">Called - Responded</option>
                      <option value="interested">Interested</option>
                      <option value="not_interested">Not Interested</option>
                      <option value="converted">Converted</option>
                    </select>
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>Product</span>
                    <select value={filterDeleteProduct} onChange={(e) => setFilterDeleteProduct(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--border-subtle)', borderRadius: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                      <option value="all">All products</option>
                      <option value="algo">Trading Algo</option>
                      <option value="tradingview_premium">TradingView Premium</option>
                    </select>
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>Older than (days)</span>
                    <input type="number" min="1" max="3650" value={filterDeleteDays} onChange={(e) => setFilterDeleteDays(Math.max(1, parseInt(e.target.value) || 1))} style={{ padding: '8px 12px', border: '1px solid var(--border-subtle)', borderRadius: '8px', fontSize: '0.85rem' }} />
                  </label>
                </div>
                <div className="crm-bulk-delete-actions">
                  <button className="crm-delete-cancel" onClick={() => setShowFilterDeleteModal(false)} disabled={filterDeleting}>
                    Cancel
                  </button>
                  <button
                    className="crm-delete-confirm-btn"
                    onClick={async () => {
                      const count = await deleteByFilter(filterDeleteStatus, filterDeleteProduct, filterDeleteDays);
                      setFilterDeleteResult(count);
                    }}
                    disabled={filterDeleting}
                  >
                    {filterDeleting ? <Loader2 size={16} className="crm-spin" /> : <Trash2 size={16} />}
                    {filterDeleting ? 'Deleting...' : 'Delete Matching Leads'}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {mergeTarget && (
        <MergeDuplicatesModal
          lead={mergeTarget}
          allLeads={leads}
          onClose={() => setMergeTarget(null)}
          onMerge={mergeDuplicates}
        />
      )}

      {showBulkMerge && (
        <BulkMergeModal
          allLeads={leads}
          duplicateLeadIds={duplicateLeadIds}
          onClose={() => setShowBulkMerge(false)}
          onMerge={mergeDuplicates}
        />
      )}

      <TeamChatWidget session={session} userRole={userRole} />

      {showTrashModal && (
        <>
          <div className="crm-drawer-overlay" onClick={() => !emptyingTrash && setShowTrashModal(false)} />
          <div className="crm-bulk-delete-modal" style={{ maxWidth: '560px' }}>
            <div className="crm-bulk-delete-icon" style={{ background: 'rgba(100,116,139,0.1)', color: 'var(--text-dark)' }}>
              <Trash2 size={32} />
            </div>
            <h3>Recycle Bin</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-dark)' }}>Deleted leads are stored here for 30 days. Restore them or permanently delete.</p>
            <div style={{ maxHeight: '320px', overflowY: 'auto', margin: '12px 0', padding: '4px', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
              {trashedLeads.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-dark)', fontSize: '0.85rem' }}>
                  <Trash2 size={28} style={{ marginBottom: '8px', opacity: 0.3 }} />
                  <p>Recycle bin is empty.</p>
                </div>
              ) : (
                trashedLeads.map((l) => {
                  const deletedDate = new Date(l.deleted_at!);
                  const daysLeft = Math.max(0, 30 - Math.floor((Date.now() - deletedDate.getTime()) / 86400000));
                  return (
                    <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-dark)', flexShrink: 0 }}>
                        {l.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ fontSize: '0.82rem', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.full_name}</strong>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-dark)' }}>{l.email} — {daysLeft} day{daysLeft !== 1 ? 's' : ''} left</span>
                      </div>
                      <button onClick={() => restoreLead(l.id)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', border: '1px solid var(--border-subtle)', borderRadius: '6px', background: 'var(--bg-card)', fontSize: '0.72rem', fontWeight: 600, color: '#16a34a', cursor: 'pointer', flexShrink: 0 }} onMouseEnter={(e) => { e.currentTarget.style.background = '#16a34a'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.color = '#16a34a'; }}>
                        <RotateCcw size={13} /> Restore
                      </button>
                      <button onClick={() => permanentlyDeleteLead(l.id)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', background: 'var(--bg-card)', fontSize: '0.72rem', fontWeight: 600, color: '#dc2626', cursor: 'pointer', flexShrink: 0 }} onMouseEnter={(e) => { e.currentTarget.style.background = '#dc2626'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.color = '#dc2626'; }}>
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  );
                })
              )}
            </div>
            {trashedLeads.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-dark)' }}>{trashedLeads.length} lead{trashedLeads.length !== 1 ? 's' : ''} in trash</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={restoreAll} disabled={restoringAll || emptyingTrash} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 14px', border: '1px solid rgba(22,163,74,0.3)', borderRadius: '6px', background: 'rgba(22,163,74,0.06)', fontSize: '0.78rem', fontWeight: 600, color: '#16a34a', cursor: 'pointer' }}>
                    {restoringAll ? <Loader2 size={14} className="crm-spin" /> : <RotateCcw size={14} />} Restore All
                  </button>
                  <button onClick={emptyTrash} disabled={emptyingTrash || restoringAll} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 14px', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', background: 'rgba(239,68,68,0.06)', fontSize: '0.78rem', fontWeight: 600, color: '#dc2626', cursor: 'pointer' }}>
                    {emptyingTrash ? <Loader2 size={14} className="crm-spin" /> : <Trash2 size={14} />} Empty Trash
                  </button>
                </div>
              </div>
            )}
            <div className="crm-bulk-delete-actions">
              <button className="crm-delete-cancel" onClick={() => setShowTrashModal(false)} disabled={emptyingTrash || restoringAll}>
                Close
              </button>
            </div>
          </div>
        </>
      )}

      {incomingCall && (
        <>
          <div className="crm-drawer-overlay" style={{ zIndex: 9999 }} onClick={rejectIncomingCall} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: 10000, background: 'var(--bg-card)', borderRadius: '20px', padding: '32px 40px',
            boxShadow: '0 25px 60px rgba(0,0,0,0.25)', textAlign: 'center', maxWidth: '360px', width: '90%',
          }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%', background: '#16a34a',
              margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'crm-pulse 1.5s infinite',
            }}>
              <PhoneCall size={28} style={{ color: 'var(--bg-card)' }} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 4px' }}>Incoming WhatsApp Call</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-dark)', margin: '0 0 24px' }}>{incomingCall.phoneNumber}</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={rejectIncomingCall}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '12px 24px',
                  borderRadius: '12px', border: 'none', background: '#dc2626', color: 'var(--bg-card)',
                  fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                }}
              >
                <PhoneOff size={18} /> Decline
              </button>
              <button
                onClick={acceptIncomingCall}
                disabled={callConnecting}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '12px 24px',
                  borderRadius: '12px', border: 'none', background: callConnecting ? '#94a3b8' : '#16a34a', color: 'var(--bg-card)',
                  fontSize: '0.85rem', fontWeight: 600, cursor: callConnecting ? 'not-allowed' : 'pointer',
                }}
              >
                {callConnecting ? <Loader2 size={18} className="crm-spin" /> : <Phone size={18} />}
                {callConnecting ? 'Connecting...' : 'Accept'}
              </button>
            </div>
          </div>
        </>
      )}

      {activeCall && (
        <div style={{
          position: 'fixed', bottom: '20px', right: '20px', zIndex: 10000,
          background: 'var(--bg-card)', borderRadius: '16px', padding: '16px 20px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '50%', background: '#16a34a',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <PhoneCall size={18} style={{ color: 'var(--bg-card)' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>{activeCall.phoneNumber}</p>
            <p style={{ fontSize: '0.72rem', color: '#16a34a', margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a', animation: 'crm-pulse 1.5s infinite' }} />
              Connected
            </p>
          </div>
          <button
            onClick={endActiveCall}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
              borderRadius: '10px', border: 'none', background: '#dc2626', color: 'var(--bg-card)',
              fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', flexShrink: 0,
            }}
          >
            <PhoneOff size={16} /> End
          </button>
        </div>
      )}
    </div>
  );
}

// ===================== Bulk Merge Modal =====================
function BulkMergeModal({ allLeads, duplicateLeadIds, onClose, onMerge }: {
  allLeads: Lead[];
  duplicateLeadIds: Set<string>;
  onClose: () => void;
  onMerge: (keepLead: Lead, removeLead: Lead) => Promise<boolean>;
}) {
  const [merging, setMerging] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !merging) onClose(); };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [onClose, merging]);

  const normPhone = (s: string) => s.replace(/[\s+\-()]/g, '').toLowerCase();
  const normEmail = (s: string) => s.trim().toLowerCase();

  const duplicateGroups = useMemo(() => {
    const groups: Lead[][] = [];
    const visited = new Set<string>();
    const dupLeads = allLeads.filter((l) => duplicateLeadIds.has(l.id));
    for (const lead of dupLeads) {
      if (visited.has(lead.id)) continue;
      const email = normEmail(lead.email);
      const phone = normPhone(lead.mobile_number);
      const group = dupLeads.filter((l) => {
        if (visited.has(l.id)) return false;
        const e = normEmail(l.email);
        const p = normPhone(l.mobile_number);
        return (email && e === email) || (phone && p === phone);
      });
      if (group.length > 1) {
        groups.push(group);
        for (const g of group) visited.add(g.id);
      }
    }
    return groups;
  }, [allLeads, duplicateLeadIds]);

  const totalDuplicates = duplicateGroups.reduce((sum, g) => sum + g.length, 0);
  const totalToRemove = totalDuplicates - duplicateGroups.length;

  const handleBulkMerge = async () => {
    setMerging(true);
    setError('');
    setProgress({ current: 0, total: duplicateGroups.length });
    let errors = 0;
    for (let i = 0; i < duplicateGroups.length; i++) {
      const group = duplicateGroups[i];
      const keep = group.reduce((best, l) => {
        let bestScore = 0;
        let curScore = 0;
        if (best.email) bestScore++;
        if (best.mobile_number) bestScore++;
        if (best.state) bestScore++;
        if (best.fund_amount != null) bestScore++;
        if (best.notes) bestScore++;
        if ((best.tags || []).length) bestScore++;
        if (best.status !== 'new') bestScore++;
        if (l.email) curScore++;
        if (l.mobile_number) curScore++;
        if (l.state) curScore++;
        if (l.fund_amount != null) curScore++;
        if (l.notes) curScore++;
        if ((l.tags || []).length) curScore++;
        if (l.status !== 'new') curScore++;
        return curScore > bestScore ? l : best;
      });
      let currentKeep = { ...keep };
      for (const rl of group) {
        if (rl.id === currentKeep.id) continue;
        const ok = await onMerge(currentKeep, rl);
        if (!ok) { errors++; break; }
        currentKeep = {
          ...currentKeep,
          email: currentKeep.email || rl.email,
          mobile_number: currentKeep.mobile_number || rl.mobile_number,
          state: currentKeep.state || rl.state,
          fund_amount: currentKeep.fund_amount ?? rl.fund_amount,
          assigned_to: currentKeep.assigned_to || rl.assigned_to,
          status: currentKeep.status === 'new' ? rl.status : currentKeep.status,
          tags: Array.from(new Set([...(currentKeep.tags || []), ...(rl.tags || [])])),
          notes: currentKeep.notes && rl.notes ? currentKeep.notes + '\n---\n' + rl.notes : (currentKeep.notes || rl.notes),
        };
      }
      setProgress({ current: i + 1, total: duplicateGroups.length });
    }
    setMerging(false);
    if (errors > 0) {
      setError(`Failed to merge ${errors} group${errors !== 1 ? 's' : ''}. Some leads may not have been merged.`);
    } else {
      setDone(true);
      setTimeout(() => onClose(), 1500);
    }
  };

  return (
    <>
      <div className="crm-drawer-overlay" onClick={() => !merging && onClose()} />
      <div className="crm-bulk-delete-modal" style={{ maxWidth: '560px' }}>
        <div className="crm-bulk-delete-icon" style={{ background: 'rgba(16,163,74,0.1)', color: '#16a34a' }}>
          <GitMerge size={32} />
        </div>
        <h3>Merge All Duplicates</h3>

        {done ? (
          <div style={{ textAlign: 'center', padding: '24px' }}>
            <CheckCircle2 size={40} style={{ color: '#16a34a', marginBottom: '8px' }} />
            <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#16a34a' }}>All duplicates merged successfully!</p>
          </div>
        ) : merging ? (
          <div style={{ textAlign: 'center', padding: '24px' }}>
            <Loader2 size={32} className="crm-spin" style={{ color: '#16a34a', marginBottom: '12px' }} />
            <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
              Merging group {progress.current} of {progress.total}...
            </p>
            <div style={{ width: '100%', maxWidth: '320px', height: '6px', background: 'var(--border-subtle)', borderRadius: '3px', margin: '0 auto', overflow: 'hidden' }}>
              <div style={{
                width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
                height: '100%',
                background: '#16a34a',
                borderRadius: '3px',
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>
        ) : (
          <>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-dark)' }}>
              Found <strong>{duplicateGroups.length}</strong> duplicate group{duplicateGroups.length !== 1 ? 's' : ''} containing <strong>{totalDuplicates}</strong> leads. This will merge each group into the most complete lead and move the rest to the Recycle Bin.
            </p>

            <div style={{ maxHeight: '240px', overflowY: 'auto', margin: '12px 0', padding: '4px', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
              {duplicateGroups.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-dark)', fontSize: '0.85rem' }}>
                  <CheckCircle2 size={28} style={{ marginBottom: '8px', opacity: 0.3 }} />
                  <p>No duplicates found.</p>
                </div>
              ) : (
                duplicateGroups.map((group, idx) => {
                  const keep = group.reduce((best, l) => {
                    let bestScore = 0; let curScore = 0;
                    if (best.email) bestScore++; if (best.mobile_number) bestScore++; if (best.state) bestScore++;
                    if (l.email) curScore++; if (l.mobile_number) curScore++; if (l.state) curScore++;
                    return curScore > bestScore ? l : best;
                  });
                  return (
                    <div key={idx} style={{ padding: '10px 12px', borderBottom: idx < duplicateGroups.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-dark)' }}>Group {idx + 1}</span>
                        <span style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <Check size={11} /> Keep: {keep.full_name}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {group.filter((l) => l.id !== keep.id).map((l) => (
                          <span key={l.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.7rem', fontWeight: 600, color: '#dc2626', background: 'rgba(239,68,68,0.08)', padding: '2px 8px', borderRadius: '5px' }}>
                            <Trash2 size={9} /> {l.full_name}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {error && <div className="crm-error" style={{ marginBottom: '12px' }}>{error}</div>}

            <div className="crm-bulk-delete-actions">
              <button className="crm-delete-cancel" onClick={onClose} disabled={merging}>
                Cancel
              </button>
              <button
                className="crm-delete-confirm-btn"
                onClick={handleBulkMerge}
                disabled={merging || duplicateGroups.length === 0}
                style={{ background: merging ? '#94a3b8' : '#16a34a' }}
              >
                {merging ? <Loader2 size={16} className="crm-spin" /> : <GitMerge size={16} />}
                {merging ? 'Merging...' : `Merge All (${totalToRemove} to remove)`}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ===================== Merge Duplicates Modal =====================
function MergeDuplicatesModal({ lead, allLeads, onClose, onMerge }: {
  lead: Lead;
  allLeads: Lead[];
  onClose: () => void;
  onMerge: (keepLead: Lead, removeLead: Lead) => Promise<boolean>;
}) {
  const [keepId, setKeepId] = useState<string>(lead.id);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const normPhone = (s: string) => s.replace(/[\s+\-()]/g, '').toLowerCase();
  const normEmail = (s: string) => s.trim().toLowerCase();

  const duplicates = useMemo(() => {
    const email = normEmail(lead.email);
    const phone = normPhone(lead.mobile_number);
    return allLeads.filter((l) => {
      if (l.id === lead.id) return true;
      const emailMatch = email && normEmail(l.email) === email;
      const phoneMatch = phone && normPhone(l.mobile_number) === phone;
      return emailMatch || phoneMatch;
    });
  }, [lead, allLeads]);

  const keepLead = duplicates.find((l) => l.id === keepId) || duplicates[0];
  const removeLeads = duplicates.filter((l) => l.id !== keepId);

  const handleMerge = async () => {
    if (removeLeads.length === 0) { onClose(); return; }
    setMerging(true);
    setError('');
    let currentKeep = { ...keepLead };
    let allOk = true;
    for (const rl of removeLeads) {
      const ok = await onMerge(currentKeep, rl);
      if (!ok) { allOk = false; break; }
      currentKeep = {
        ...currentKeep,
        email: currentKeep.email || rl.email,
        mobile_number: currentKeep.mobile_number || rl.mobile_number,
        state: currentKeep.state || rl.state,
        fund_amount: currentKeep.fund_amount ?? rl.fund_amount,
        assigned_to: currentKeep.assigned_to || rl.assigned_to,
        status: currentKeep.status === 'new' ? rl.status : currentKeep.status,
        tags: Array.from(new Set([...(currentKeep.tags || []), ...(rl.tags || [])])),
        notes: currentKeep.notes && rl.notes ? currentKeep.notes + '\n---\n' + rl.notes : (currentKeep.notes || rl.notes),
      };
    }
    setMerging(false);
    if (allOk) {
      setDone(true);
      setTimeout(() => onClose(), 1200);
    } else {
      setError('Failed to merge some leads. Please try again.');
    }
  };

  const FieldRow = ({ label, value, isBetter }: { label: string; value: string; isBetter?: boolean }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ fontSize: '0.74rem', color: 'var(--text-dark)', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: isBetter ? '#16a34a' : 'var(--text-muted)', textAlign: 'right', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value || '—'}
      </span>
    </div>
  );

  return (
    <>
      <div className="crm-drawer-overlay" onClick={() => !merging && onClose()} />
      <div className="crm-bulk-delete-modal" style={{ maxWidth: '640px' }}>
        <div className="crm-bulk-delete-icon" style={{ background: 'rgba(245,158,11,0.1)', color: '#d97706' }}>
          <GitMerge size={32} />
        </div>
        <h3>Merge Duplicate Leads</h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-dark)' }}>
          {duplicates.length} lead{duplicates.length !== 1 ? 's' : ''} share the same email or phone number. Pick which one to keep — the others will be merged into it and moved to the Recycle Bin.
        </p>

        {done ? (
          <div style={{ textAlign: 'center', padding: '24px' }}>
            <CheckCircle2 size={40} style={{ color: '#16a34a', marginBottom: '8px' }} />
            <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#16a34a' }}>Merged successfully!</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '12px', margin: '16px 0', overflowX: 'auto', paddingBottom: '4px' }}>
              {duplicates.map((l) => {
                const isSelected = l.id === keepId;
                return (
                  <div
                    key={l.id}
                    onClick={() => setKeepId(l.id)}
                    style={{
                      flex: '1 1 200px',
                      minWidth: '200px',
                      border: isSelected ? '2px solid #16a34a' : '1px solid var(--border-subtle)',
                      borderRadius: '10px',
                      padding: '12px',
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(34,197,94,0.04)' : 'var(--bg-card)',
                      transition: 'all 0.15s',
                      position: 'relative',
                    }}
                  >
                    {isSelected && (
                      <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '50%', background: '#16a34a', color: 'var(--bg-card)' }}>
                        <Check size={13} />
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-dark)', flexShrink: 0 }}>
                        {l.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ fontSize: '0.82rem', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.full_name}</strong>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-dark)' }}>{new Date(l.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      </div>
                    </div>
                    <FieldRow label="Email" value={l.email} isBetter={isSelected && !keepLead.email && !!l.email} />
                    <FieldRow label="Phone" value={l.mobile_number} isBetter={isSelected && !keepLead.mobile_number && !!l.mobile_number} />
                    <FieldRow label="State" value={l.state} isBetter={isSelected && !keepLead.state && !!l.state} />
                    <FieldRow label="Status" value={l.status.replace(/_/g, ' ')} />
                    <FieldRow label="Fund" value={l.fund_amount != null ? `${l.fund_amount.toLocaleString('en-US')}` : ''} isBetter={isSelected && !keepLead.fund_amount && l.fund_amount != null} />
                    <FieldRow label="Tags" value={(l.tags || []).join(', ')} />
                    <FieldRow label="Notes" value={l.notes ? 'Yes' : ''} />
                  </div>
                );
              })}
            </div>

            <div style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.15)', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px' }}>
              <p style={{ fontSize: '0.76rem', color: '#2563eb', margin: 0, lineHeight: 1.5 }}>
                <strong>Keep:</strong> {keepLead.full_name} &nbsp;|&nbsp;
                <strong>Remove:</strong> {removeLeads.map((l) => l.full_name).join(', ')}
              </p>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-dark)', margin: '6px 0 0 0', lineHeight: 1.4 }}>
                Missing fields from the removed leads will be filled into the kept lead. Tags will be combined. Notes will be appended. The removed leads go to the Recycle Bin.
              </p>
            </div>

            {error && <div className="crm-error" style={{ marginBottom: '12px' }}>{error}</div>}

            <div className="crm-bulk-delete-actions">
              <button className="crm-delete-cancel" onClick={onClose} disabled={merging}>
                Cancel
              </button>
              <button
                className="crm-delete-confirm-btn"
                onClick={handleMerge}
                disabled={merging || removeLeads.length === 0}
                style={{ background: merging ? '#94a3b8' : '#16a34a' }}
              >
                {merging ? <Loader2 size={16} className="crm-spin" /> : <GitMerge size={16} />}
                {merging ? 'Merging...' : `Merge ${removeLeads.length} into ${keepLead.full_name.split(' ')[0]}`}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ===================== Dialer Panel =====================
const DIALER_KEYS = [
  { digit: '1', letters: '' },
  { digit: '2', letters: 'ABC' },
  { digit: '3', letters: 'DEF' },
  { digit: '4', letters: 'GHI' },
  { digit: '5', letters: 'JKL' },
  { digit: '6', letters: 'MNO' },
  { digit: '7', letters: 'PQRS' },
  { digit: '8', letters: 'TUV' },
  { digit: '9', letters: 'WXYZ' },
  { digit: '*', letters: '' },
  { digit: '0', letters: '+' },
  { digit: '#', letters: '' },
];

function DialerPanel({ onClose, number, setNumber, callInitiated, setCallInitiated, session }: {
  onClose: () => void;
  number: string;
  setNumber: (v: string) => void;
  callInitiated: boolean;
  setCallInitiated: (v: boolean) => void;
  session: Session;
}) {
  const [recentCalls, setRecentCalls] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('dialerRecentCalls') || '[]'); } catch { return []; }
  });
  const [twilioConfigured, setTwilioConfigured] = useState<boolean | null>(null);
  const [waConfigured, setWaConfigured] = useState<boolean | null>(null);
  const [callMode, setCallMode] = useState<'phone' | 'whatsapp'>('phone');
  const [callStatus, setCallStatus] = useState<string>('');
  const [callError, setCallError] = useState('');
  const [calling, setCalling] = useState(false);
  const [permissionState, setPermissionState] = useState<'unknown' | 'checking' | 'granted' | 'denied' | 'none'>('unknown');
  const [requestingPermission, setRequestingPermission] = useState(false);
  const [permissionSent, setPermissionSent] = useState(false);
  const [recordEnabled, setRecordEnabled] = useState(false);
  const [transcribeEnabled, setTranscribeEnabled] = useState(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const permPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    (async () => {
      const [twilioRes, waRes] = await Promise.all([
        supabase.from('twilio_settings').select('twilio_number, provider').maybeSingle(),
        supabase.from('whatsapp_settings').select('phone_number_id, access_token').maybeSingle(),
      ]);
      setTwilioConfigured(!!(twilioRes.data && twilioRes.data.twilio_number));
      setWaConfigured(!!(waRes.data && waRes.data.phone_number_id && waRes.data.access_token));
    })();
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (permPollRef.current) clearInterval(permPollRef.current);
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    };
  }, []);

  const pressKey = (digit: string) => {
    setNumber((number + digit).slice(0, 20));
    setCallInitiated(false);
  };

  const handleBackspace = () => {
    setNumber(number.slice(0, -1));
    setCallInitiated(false);
  };

  const recordCall = (num: string) => {
    const clean = num.trim();
    if (!clean) return;
    setRecentCalls((prev) => {
      const next = [clean, ...prev.filter((c) => c !== clean)].slice(0, 10);
      try { localStorage.setItem('dialerRecentCalls', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const checkCallPermission = async (phoneNum: string): Promise<boolean> => {
    const token = session.access_token;
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-call`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: phoneNum, action: 'check_permission' }),
    });
    const data = await res.json();
    if (!res.ok || data.error) return false;
    return data.canCall === true;
  };

  const sendPermissionRequest = async () => {
    if (!number.trim()) return;
    setRequestingPermission(true);
    setCallError('');
    try {
      const token = session.access_token;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-call`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: number.replace(/\s/g, ''), action: 'request_permission' }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setCallError(data.error || 'Failed to send permission request');
        return;
      }
      setPermissionSent(true);
      setPermissionState('none');

      // Poll for permission response
      let pollCount = 0;
      const maxPolls = 120;
      permPollRef.current = setInterval(async () => {
        pollCount++;
        if (pollCount > maxPolls) {
          if (permPollRef.current) clearInterval(permPollRef.current);
          return;
        }
        try {
          const { data: permData } = await supabase
            .from('wa_call_permissions')
            .select('response, is_permanent')
            .eq('phone_number', number.replace(/\s/g, '').replace(/^\+/, ''))
            .maybeSingle();

          if (permData) {
            if (permData.response === 'accept') {
              if (permPollRef.current) clearInterval(permPollRef.current);
              setPermissionState('granted');
              setPermissionSent(false);
            } else if (permData.response === 'reject') {
              if (permPollRef.current) clearInterval(permPollRef.current);
              setPermissionState('denied');
              setPermissionSent(false);
            }
          }
        } catch { /* continue polling */ }
      }, 2000);
    } catch {
      setCallError('Network error — could not send permission request');
    } finally {
      setRequestingPermission(false);
    }
  };

  const handleCall = async () => {
    if (!number.trim()) return;
    recordCall(number);
    setCallInitiated(true);
    setCallStatus('');
    setCallError('');

    if (callMode === 'whatsapp') {
      // Check call permission before attempting the call
      setPermissionState('checking');
      const canCall = await checkCallPermission(number.replace(/\s/g, ''));
      if (canCall) {
        setPermissionState('granted');
        await handleWhatsAppCall();
      } else {
        setPermissionState('none');
        setCallInitiated(false);
      }
      return;
    } else if (twilioConfigured) {
      setCalling(true);
      try {
        const token = session.access_token;
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twilio-call`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: number.replace(/\s/g, '') }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          setCallError(data.error || 'Call failed');
          setCallStatus('failed');
        } else {
          setCallStatus(data.status || 'initiated');
        }
      } catch {
        setCallError('Network error — could not reach calling service');
        setCallStatus('failed');
      }
      setCalling(false);
    } else {
      window.location.href = `tel:${number.replace(/\s/g, '')}`;
    }
  };

  const handleWhatsAppCall = async () => {
    setCalling(true);
    setCallStatus('connecting');

    try {
      // Create WebRTC peer connection for audio-only call
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      pcRef.current = pc;

      // Add local audio track (microphone)
      const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

      // Listen for remote audio
      pc.ontrack = (event) => {
        const remoteAudio = new Audio();
        remoteAudio.srcObject = event.streams[0];
        remoteAudio.autoplay = true;
      };

      // Create SDP offer
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering to complete
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') { resolve(); return; }
        const checkState = () => { if (pc.iceGatheringState === 'complete') { pc.removeEventListener('icegatheringstatechange', checkState); resolve(); } };
        pc.addEventListener('icegatheringstatechange', checkState);
        setTimeout(resolve, 3000);
      });

      const sdpOffer = pc.localDescription?.sdp || '';
      if (!sdpOffer) {
        throw new Error('Failed to create SDP offer for WhatsApp call');
      }

      // Create a call session in the database
      const { data: sessionData, error: sessionError } = await supabase
        .from('wa_call_sessions')
        .insert({
          phone_number: number.replace(/\s/g, ''),
          status: 'initiating',
        })
        .select()
        .single();

      if (sessionError || !sessionData) {
        throw new Error('Failed to create call session');
      }

      const sessionId = sessionData.id;

      // Send the SDP offer to the edge function to initiate the call via Meta API
      const token = session.access_token;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-call`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
        to: number.replace(/\s/g, ''),
        sdpOffer,
        sessionId,
        recording: recordEnabled ? { enabled: true, purpose: 'quality assurance', announcementLanguage: 'en_US' } : undefined,
        transcription: transcribeEnabled ? { enabled: true, purpose: 'quality assurance', announcementLanguage: 'en_US' } : undefined,
      }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to initiate WhatsApp call');
      }

      setCallStatus('ringing');

      // Poll for the SDP answer from Meta (delivered via webhook)
      const callId = data.callId;
      let pollCount = 0;
      const maxPolls = 60;

      await new Promise<void>((resolve, reject) => {
        pollRef.current = setInterval(async () => {
          pollCount++;
          if (pollCount > maxPolls) {
            if (pollRef.current) clearInterval(pollRef.current);
            reject(new Error('Call timed out waiting for WhatsApp response'));
            return;
          }

          try {
            const query = callId
              ? supabase.from('wa_call_sessions').select('status, sdp_answer').eq('id', sessionId).maybeSingle()
              : supabase.from('wa_call_sessions').select('status, sdp_answer').eq('id', sessionId).maybeSingle();
            const { data: pollData } = await query;

            if (!pollData) return;

            const currentStatus = pollData.status || '';

            if (currentStatus === 'rejected' || currentStatus === 'failed') {
              if (pollRef.current) clearInterval(pollRef.current);
              reject(new Error(`Call ${currentStatus}`));
              return;
            }

            if (pollData.sdp_answer && currentStatus === 'accepted') {
              if (pollRef.current) clearInterval(pollRef.current);

              try {
                await pc.setRemoteDescription(new RTCSessionDescription({
                  type: 'answer',
                  sdp: pollData.sdp_answer,
                }));
                setCallStatus('connected');
                resolve();
              } catch (sdpErr) {
                reject(new Error('Failed to establish WhatsApp call connection'));
              }
              return;
            }

            if (currentStatus && currentStatus !== 'initiating' && currentStatus !== 'accepted') {
              setCallStatus(currentStatus);
            }
          } catch {
            // Polling error — continue
          }
        }, 1500);
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'WhatsApp call failed';
      setCallError(msg);
      setCallStatus('failed');
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    } finally {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      setCalling(false);
    }
  };

  const handleEndCall = () => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (permPollRef.current) { clearInterval(permPollRef.current); permPollRef.current = null; }
    setCalling(false);
    setCallInitiated(false);
    setCallStatus('');
    setCallError('');
    setPermissionState('unknown');
    setPermissionSent(false);
  };

  return (
    <>
      <div className="crm-dialer-overlay" onClick={onClose} />
      <div className="crm-dialer-panel">
        <div className="crm-dialer-header">
          <div className="crm-dialer-header-inner">
            <div className="crm-dialer-title">
              <div className="crm-dialer-icon">
                <DialpadIcon size={20} />
              </div>
              <div>
                <h2>Dialer</h2>
                <p>Call leads directly</p>
              </div>
            </div>
            <button className="crm-drawer-close" onClick={onClose} aria-label="Close">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="crm-dialer-body">
          {/* Call mode toggle */}
          {waConfigured && (
            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', padding: '4px', background: 'var(--bg-light)', borderRadius: '10px' }}>
              <button
                type="button"
                onClick={() => { setCallMode('phone'); setCallInitiated(false); setCallStatus(''); setCallError(''); }}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: 'none',
                  borderRadius: '8px',
                  background: callMode === 'phone' ? '#fff' : 'transparent',
                  color: callMode === 'phone' ? '#1e293b' : 'var(--text-dark)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                  transition: 'all 0.2s',
                  boxShadow: callMode === 'phone' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                <Phone size={14} /> Phone
              </button>
              <button
                type="button"
                onClick={() => { setCallMode('whatsapp'); setCallInitiated(false); setCallStatus(''); setCallError(''); }}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: 'none',
                  borderRadius: '8px',
                  background: callMode === 'whatsapp' ? '#fff' : 'transparent',
                  color: callMode === 'whatsapp' ? '#16a34a' : 'var(--text-dark)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                  transition: 'all 0.2s',
                  boxShadow: callMode === 'whatsapp' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                <MessageCircle size={14} /> WhatsApp
              </button>
            </div>
          )}

          {/* Number display */}
          <div className="crm-dialer-display-wrap">
            <div className="crm-dialer-display">
              <input
                type="text"
                value={number}
                onChange={(e) => { setNumber(e.target.value.replace(/[^0-9+\-#\s()*]/g, '').slice(0, 20)); setCallInitiated(false); }}
                placeholder="Enter number"
                className="crm-dialer-input"
                autoFocus
              />
              {number && (
                <button className="crm-dialer-backspace" onClick={handleBackspace} aria-label="Delete last digit">
                  <DeleteIcon size={20} />
                </button>
              )}
            </div>
            {callInitiated && number && (
              <div className="crm-dialer-calling">
                <PhoneOutgoing size={16} className="crm-dialer-calling-icon" />
                <span>{calling ? 'Connecting call...' : `Calling ${number}...`}</span>
                {callStatus && callStatus !== 'failed' && (
                  <span style={{ marginLeft: '8px', fontSize: '0.72rem', color: callStatus === 'connected' ? '#16a34a' : '#0d9488', fontWeight: 600 }}>— {callStatus}</span>
                )}
                {callError && (
                  <span style={{ marginLeft: '8px', fontSize: '0.72rem', color: '#dc2626', fontWeight: 600 }}>— {callError}</span>
                )}
              </div>
            )}
            {callMode === 'phone' && twilioConfigured === false && (
              <div style={{ padding: '6px 12px', fontSize: '0.72rem', color: 'var(--text-dark)', textAlign: 'center' }}>
                Using device dialer. Configure a calling provider in Settings for virtual calling.
              </div>
            )}
            {callMode === 'phone' && twilioConfigured === true && (
              <div style={{ padding: '6px 12px', fontSize: '0.72rem', color: '#0d9488', textAlign: 'center', fontWeight: 600 }}>
                <PhoneCall size={12} style={{ display: 'inline', marginRight: '4px' }} /> Calling via virtual number
              </div>
            )}
            {callMode === 'whatsapp' && permissionState !== 'none' && (
              <div style={{ padding: '6px 12px', fontSize: '0.72rem', color: '#16a34a', textAlign: 'center', fontWeight: 600 }}>
                <MessageCircle size={12} style={{ display: 'inline', marginRight: '4px' }} /> Calling via WhatsApp — uses your mic
              </div>
            )}
            {callMode === 'whatsapp' && permissionState === 'none' && number.trim() && (
              <div style={{ padding: '10px 14px', background: 'var(--bg-card-hover)', borderRadius: '10px', border: '1px solid #fde68a', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#92400e', fontWeight: 600 }}>
                  <ShieldAlert size={14} /> Call permission required
                </div>
                <p style={{ fontSize: '0.72rem', color: 'var(--gold-dark)', lineHeight: 1.4 }}>
                  WhatsApp requires the recipient to grant call permission before you can place a call. Send a permission request and wait for their response.
                </p>
                {permissionSent ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: '#0d9488', fontWeight: 600 }}>
                    <Loader2 size={14} className="crm-spin" /> Waiting for permission response...
                  </div>
                ) : permissionState === 'denied' ? (
                  <div style={{ fontSize: '0.72rem', color: '#dc2626', fontWeight: 600 }}>
                    Permission denied. The recipient rejected the call permission request.
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={sendPermissionRequest}
                    disabled={requestingPermission}
                    style={{
                      padding: '8px 14px',
                      border: 'none',
                      borderRadius: '8px',
                      background: '#16a34a',
                      color: 'var(--bg-card)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: requestingPermission ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      opacity: requestingPermission ? 0.6 : 1,
                    }}
                  >
                    {requestingPermission ? <Loader2 size={14} className="crm-spin" /> : <Send size={14} />}
                    Request Call Permission
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Recording & Transcription toggles (WhatsApp mode only) */}
          {callMode === 'whatsapp' && !callInitiated && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <button
                type="button"
                onClick={() => setRecordEnabled((v) => !v)}
                style={{
                  flex: 1, padding: '8px 10px', border: `1.5px solid ${recordEnabled ? '#16a34a' : 'var(--border-subtle)'}`,
                  borderRadius: '8px', background: recordEnabled ? 'rgba(22,163,74,0.08)' : 'var(--bg-card)',
                  color: recordEnabled ? '#16a34a' : 'var(--text-dark)', fontSize: '0.72rem', fontWeight: 600,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                  transition: 'all 0.2s',
                }}
              >
                <Mic size={13} /> Record
              </button>
              <button
                type="button"
                onClick={() => setTranscribeEnabled((v) => !v)}
                style={{
                  flex: 1, padding: '8px 10px', border: `1.5px solid ${transcribeEnabled ? '#0891b2' : 'var(--border-subtle)'}`,
                  borderRadius: '8px', background: transcribeEnabled ? 'rgba(8,145,178,0.08)' : 'var(--bg-card)',
                  color: transcribeEnabled ? '#0891b2' : 'var(--text-dark)', fontSize: '0.72rem', fontWeight: 600,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                  transition: 'all 0.2s',
                }}
              >
                <FileText size={13} /> Transcribe
              </button>
            </div>
          )}

          {/* Keypad */}
          <div className="crm-dialer-keypad">
            {DIALER_KEYS.map((key) => (
              <button
                key={key.digit}
                className="crm-dialer-key"
                onClick={() => pressKey(key.digit)}
              >
                <span className="crm-dialer-key-digit">{key.digit}</span>
                {key.letters && <span className="crm-dialer-key-letters">{key.letters}</span>}
              </button>
            ))}
          </div>

          {/* Call / End Call buttons */}
          <div className="crm-dialer-call-wrap">
            {callStatus === 'connected' ? (
              <button
                className="crm-dialer-call-btn"
                style={{ background: '#dc2626' }}
                onClick={handleEndCall}
              >
                <PhoneOff size={24} />
                <span>End Call</span>
              </button>
            ) : (
              <button
                className={`crm-dialer-call-btn ${callInitiated ? 'calling' : ''}`}
                onClick={handleCall}
                disabled={!number.trim() || calling}
              >
                {calling ? <Loader2 size={24} className="crm-spin" /> : callInitiated ? <PhoneOutgoing size={24} /> : callMode === 'whatsapp' ? <MessageCircle size={24} /> : <Phone size={24} />}
                <span>{calling ? 'Connecting...' : callInitiated ? 'Calling...' : callMode === 'whatsapp' ? 'WhatsApp Call' : 'Call'}</span>
              </button>
            )}
          </div>

          {/* Recent calls */}
          {recentCalls.length > 0 && (
            <div className="crm-dialer-quick">
              <div className="crm-dialer-quick-label">
                <Clock size={14} /> Recent Calls
              </div>
              <div className="crm-dialer-quick-list">
                {recentCalls.map((num, idx) => (
                  <button
                    key={idx}
                    className="crm-dialer-quick-item"
                    onClick={() => { setNumber(num); setCallInitiated(false); }}
                  >
                    <div className="crm-dialer-quick-avatar">
                      <PhoneOutgoing size={15} />
                    </div>
                    <div className="crm-dialer-quick-info">
                      <strong>{num}</strong>
                    </div>
                    <Phone size={15} className="crm-dialer-quick-phone" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ===================== Add Lead Modal =====================
function AddLeadModal({ onClose, onAdd, onMerge, existingLeads, stages }: {
  onClose: () => void;
  onAdd: (form: NewLeadForm) => Promise<boolean>;
  onMerge: (existingLead: Lead, form: NewLeadForm) => Promise<boolean>;
  existingLeads: Lead[];
  stages: { key: LeadStatus; label: string }[];
}) {
  const [form, setForm] = useState<NewLeadForm>({
    full_name: '',
    mobile_number: '',
    email: '',
    state: '',
    trading_product: 'algo',
    service_interest: 'algo',
    referral_readiness: 'yes',
    funding_readiness: 'now',
    status: 'new',
    notes: '',
    fund_amount: null,
    lead_source: 'Manual Entry',
  });
  const [saving, setSaving] = useState(false);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState('');
  const [mergeSuccess, setMergeSuccess] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const update = (field: keyof NewLeadForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  const normalizePhone = (s: string) => s.replace(/[\s+\-()]/g, '').toLowerCase();
  const normalizeEmail = (s: string) => s.trim().toLowerCase();

  const duplicateLead = useMemo(() => {
    const email = normalizeEmail(form.email);
    const phone = normalizePhone(form.mobile_number);
    if (!email && !phone) return null;
    return existingLeads.find((l) => {
      const emailMatch = email && normalizeEmail(l.email) === email;
      const phoneMatch = phone && normalizePhone(l.mobile_number) === phone;
      return emailMatch || phoneMatch;
    }) || null;
  }, [form.email, form.mobile_number, existingLeads]);

  const canSubmit = Boolean(form.full_name && form.mobile_number && form.email && form.state && form.trading_product);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit || saving) return;
    setSaving(true);
    setError('');
    const success = await onAdd(form);
    if (success) {
      onClose();
    } else {
      setSaving(false);
      setError('Failed to add lead. Please try again.');
    }
  };

  return (
    <>
      <div className="crm-drawer-overlay" onClick={onClose} />
      <div className="crm-add-lead-modal">
        <div className="crm-add-lead-header">
          <div className="crm-add-lead-title">
            <div className="crm-add-lead-icon">
              <UserCheck size={22} />
            </div>
            <div>
              <span className="crm-add-lead-kicker">Lead intake</span>
              <h2>Add New Lead</h2>
              <p>Capture contact details and qualify the opportunity</p>
            </div>
          </div>
          <button className="crm-drawer-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="crm-add-lead-form">
          <div className="crm-add-lead-grid">
            <label className="crm-add-lead-field">
              <span>Full Name <em>*</em></span>
              <input
                type="text"
                required
                value={form.full_name}
                onChange={(e) => update('full_name', e.target.value)}
                placeholder="Enter full name"
              />
            </label>
            <label className="crm-add-lead-field">
              <span>Mobile Number <em>*</em></span>
              <input
                type="tel"
                required
                value={form.mobile_number}
                onChange={(e) => update('mobile_number', e.target.value)}
                placeholder="e.g. +91 98765 43210"
                inputMode="tel"
              />
            </label>
            <label className="crm-add-lead-field">
              <span>Email <em>*</em></span>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <label className="crm-add-lead-field">
              <span>State <em>*</em></span>
              <select required value={form.state} onChange={(e) => update('state', e.target.value)}>
                <option value="" disabled>Select state</option>
                {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="crm-add-lead-field crm-add-lead-service-field">
              <span>Which service are they interested in? <em>*</em></span>
              <div className="crm-add-lead-products">
                <button
                  type="button"
                  className={form.trading_product === 'algo' ? 'selected' : ''}
                  onClick={() => { update('trading_product', 'algo'); update('service_interest', 'algo'); }}
                >
                  <Bot size={16} /> Algo Trading Access
                </button>
                <button
                  type="button"
                  className={form.trading_product === 'tradingview_premium' ? 'selected' : ''}
                  onClick={() => { update('trading_product', 'tradingview_premium'); update('service_interest', 'indicator'); }}
                >
                  <BarChart3 size={16} /> TradingView Premium
                </button>
                <button
                  type="button"
                  className={form.trading_product === 'both' ? 'selected' : ''}
                  onClick={() => { update('trading_product', 'both'); update('service_interest', 'both'); }}
                >
                  <Star size={16} /> Both Services
                </button>
              </div>
            </label>
            <label className="crm-add-lead-field">
              <span>Initial Status</span>
              <select value={form.status} onChange={(e) => update('status', e.target.value)}>
                {stages.map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </label>
            <label className="crm-add-lead-field">
              <span>Lead Source</span>
              <select value={form.lead_source} onChange={(e) => update('lead_source', e.target.value)} style={{ cursor: 'pointer' }}>
                {SOURCE_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="crm-add-lead-field">
              <span>Fund Amount (USD, optional)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.fund_amount ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm((prev) => ({ ...prev, fund_amount: val === '' ? null : parseFloat(val) }));
                }}
                placeholder="e.g. 5000"
              />
            </label>
            <label className="crm-add-lead-field">
              <span>Ready to open an account using our referral link? <em>*</em></span>
              <select required value={form.referral_readiness} onChange={(e) => update('referral_readiness', e.target.value)}>
                <option value="yes">Yes</option>
                <option value="need_more_information">Need more information</option>
                <option value="no">No</option>
              </select>
            </label>
            <label className="crm-add-lead-field">
              <span>When can they fund at least $500? <em>*</em></span>
              <select required value={form.funding_readiness} onChange={(e) => update('funding_readiness', e.target.value)}>
                <option value="now">Yes, I can fund it now</option>
                <option value="after_demo">After using a demo account</option>
                <option value="not_at_moment">Not at the moment</option>
              </select>
            </label>
          </div>

          <label className="crm-add-lead-field crm-add-lead-notes">
            <span>Notes (optional)</span>
            <textarea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              placeholder="Add any initial notes about this lead..."
              rows={3}
            />
          </label>

          {error && <div className="crm-error">{error}</div>}

          {duplicateLead && (
            <div style={{
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: '10px',
              padding: '14px 16px',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
            }}>
              <AlertTriangle size={18} style={{ color: '#d97706', flexShrink: 0, marginTop: '1px' }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#92400e', margin: '0 0 4px 0' }}>
                  Duplicate Lead Detected
                </p>
                <p style={{ fontSize: '0.78rem', color: '#a16207', margin: '0 0 6px 0', lineHeight: 1.4 }}>
                  A lead with this {normalizeEmail(form.email) === normalizeEmail(duplicateLead.email) && form.email ? 'email' : 'phone number'} already exists in your CRM.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '0.75rem', color: 'var(--gold-dark)', marginBottom: '10px' }}>
                  <span style={{ background: 'rgba(245,158,11,0.12)', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>
                    {duplicateLead.full_name}
                  </span>
                  <span style={{ background: 'rgba(245,158,11,0.12)', padding: '2px 8px', borderRadius: '6px' }}>
                    {duplicateLead.email}
                  </span>
                  <span style={{ background: 'rgba(245,158,11,0.12)', padding: '2px 8px', borderRadius: '6px' }}>
                    {duplicateLead.mobile_number}
                  </span>
                  <span style={{ background: 'rgba(245,158,11,0.12)', padding: '2px 8px', borderRadius: '6px' }}>
                    Added {new Date(duplicateLead.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                  <span style={{ background: 'rgba(59,130,246,0.1)', padding: '2px 8px', borderRadius: '6px', color: '#2563eb', fontWeight: 600 }}>
                    {duplicateLead.status.replace(/_/g, ' ')}
                  </span>
                </div>

                {mergeSuccess ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#16a34a', fontWeight: 600, padding: '8px 12px', background: 'rgba(34,197,94,0.08)', borderRadius: '8px' }}>
                    <CheckCircle2 size={16} /> Merged successfully! Closing...
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      disabled={merging || saving}
                      onClick={async () => {
                        setMerging(true);
                        setError('');
                        const success = await onMerge(duplicateLead, form);
                        if (success) {
                          setMergeSuccess(true);
                          setTimeout(() => onClose(), 1200);
                        } else {
                          setError('Failed to merge. Please try again.');
                        }
                        setMerging(false);
                      }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', border: 'none', borderRadius: '8px', background: merging ? '#94a3b8' : '#2563eb', color: 'var(--bg-card)', fontSize: '0.8rem', fontWeight: 600, cursor: merging ? 'not-allowed' : 'pointer' }}
                    >
                      {merging ? <Loader2 size={14} className="animate-spin" /> : <GitMerge size={14} />}
                      {merging ? 'Merging...' : 'Merge into Existing'}
                    </button>
                    <button
                      type="submit"
                      disabled={!canSubmit || saving || merging}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', border: '1px solid rgba(245,158,11,0.4)', borderRadius: '8px', background: 'var(--bg-card)', color: '#92400e', fontSize: '0.8rem', fontWeight: 600, cursor: !canSubmit || saving || merging ? 'not-allowed' : 'pointer' }}
                    >
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                      Create as New Lead
                    </button>
                  </div>
                )}
                <p style={{ fontSize: '0.74rem', color: '#a16207', margin: '8px 0 0 0', fontStyle: 'italic', lineHeight: 1.4 }}>
                  <strong>Merge</strong> fills any missing fields on the existing lead. <strong>Create as New</strong> adds a separate lead.
                </p>
              </div>
            </div>
          )}

          <div className="crm-add-lead-actions">
            <button type="button" className="crm-add-lead-cancel" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="crm-add-lead-submit" disabled={!canSubmit || saving}>
              {saving ? <Loader2 size={18} className="crm-spin" /> : <Plus size={18} />}
              {saving ? 'Adding...' : 'Add Lead'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ===================== Bulk Upload Modal =====================
type ParsedRow = {
  full_name: string;
  mobile_number: string;
  email: string;
  state: string;
  trading_product: 'algo' | 'tradingview_premium' | 'both';
  service_interest: 'indicator' | 'algo' | 'both';
  referral_readiness: 'yes' | 'need_more_information' | 'no';
  funding_readiness: 'now' | 'after_demo' | 'not_at_moment';
  status: LeadStatus;
  notes: string;
  fund_amount: number | null;
  _valid: boolean;
  _error: string;
};

const COLUMN_ALIASES: Record<string, string> = {
  'full_name': 'full_name', 'name': 'full_name', 'full name': 'full_name', 'lead name': 'full_name', 'customer name': 'full_name',
  'mobile_number': 'mobile_number', 'mobile': 'mobile_number', 'phone': 'mobile_number', 'mobile no': 'mobile_number', 'mobile number': 'mobile_number', 'contact': 'mobile_number', 'contact number': 'mobile_number',
  'email': 'email', 'email address': 'email', 'e-mail': 'email',
  'state': 'state', 'location': 'state', 'region': 'state',
  'fund_amount': 'fund_amount', 'fund': 'fund_amount', 'funds': 'fund_amount', 'fund amount': 'fund_amount', 'investment amount': 'fund_amount', 'capital': 'fund_amount',
  'trading_product': 'trading_product', 'product': 'trading_product', 'trading product': 'trading_product', 'interested in': 'trading_product', 'service interest': 'service_interest', 'service': 'service_interest', 'referral readiness': 'referral_readiness', 'referral link': 'referral_readiness', 'funding readiness': 'funding_readiness', 'funding plan': 'funding_readiness',
  'status': 'status', 'lead status': 'status', 'stage': 'status',
  'notes': 'notes', 'note': 'notes', 'remarks': 'notes', 'comment': 'notes', 'comments': 'notes',
};

const STATUS_ALIASES: Record<string, LeadStatus> = {
  'new': 'new',
  'called no response': 'called_no_response', 'called - no response': 'called_no_response', 'called_no_response': 'called_no_response', 'no response': 'called_no_response',
  'called responded': 'called_responded', 'called - responded': 'called_responded', 'called_responded': 'called_responded', 'responded': 'called_responded',
  'interested': 'interested',
  'not interested': 'not_interested', 'not_interested': 'not_interested',
  'converted': 'converted',
};

const PRODUCT_ALIASES: Record<string, 'algo' | 'tradingview_premium' | 'both'> = {
  'algo': 'algo', 'trading algo': 'algo', 'algo trading': 'algo', 'algo trading access': 'algo',
  'tradingview': 'tradingview_premium', 'tradingview premium': 'tradingview_premium', 'tv': 'tradingview_premium', 'tv premium': 'tradingview_premium', 'tradingview_premium': 'tradingview_premium', 'indicator': 'tradingview_premium',
  'both': 'both', 'both services': 'both', 'indicator + algo': 'both', 'tradingview premium + algo': 'both',
};

function normalizeKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}



const TARGET_FIELDS: { key: string; label: string; required: boolean }[] = [
  { key: 'full_name', label: 'Full Name', required: true },
  { key: 'mobile_number', label: 'Mobile Number', required: true },
  { key: 'email', label: 'Email', required: true },
  { key: 'state', label: 'State', required: true },
  { key: 'trading_product', label: 'Trading Product', required: false },
  { key: 'service_interest', label: 'Service Interest', required: false },
  { key: 'referral_readiness', label: 'Referral Readiness', required: false },
  { key: 'funding_readiness', label: 'Funding Readiness', required: false },
  { key: 'status', label: 'Status', required: false },
  { key: 'fund_amount', label: 'Fund Amount', required: false },
  { key: 'notes', label: 'Notes', required: false },
]

function autoSuggestMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const usedTargets = new Set<string>();
  for (const header of headers) {
    const norm = normalizeKey(header);
    const canonical = COLUMN_ALIASES[norm];
    if (canonical && !usedTargets.has(canonical)) {
      mapping[header] = canonical;
      usedTargets.add(canonical);
    } else {
      mapping[header] = '';
    }
  }
  return mapping;
}

function parseRowWithMapping(raw: Record<string, unknown>, mapping: Record<string, string>): ParsedRow {
  const mapped: Record<string, string> = {};
  for (const [header, val] of Object.entries(raw)) {
    const target = mapping[header];
    if (target) {
      mapped[target] = String(val ?? '').trim();
    }
  }
  const full_name = mapped['full_name'] || '';
  const mobile_number = mapped['mobile_number'] || '';
  const email = mapped['email'] || '';
  const state = mapped['state'] || '';
  const rawProduct = normalizeKey(mapped['trading_product'] || mapped['service_interest'] || 'algo');
  const rawStatus = normalizeKey(mapped['status'] || 'new');
  const notes = mapped['notes'] || '';
  const trading_product = PRODUCT_ALIASES[rawProduct] || 'algo';
  const status = STATUS_ALIASES[rawStatus] || 'new';
  const rawReferral = normalizeKey(mapped['referral_readiness'] || 'yes');
  const rawFunding = normalizeKey(mapped['funding_readiness'] || 'now');
  const service_interest = trading_product === 'both' ? 'both' : trading_product === 'algo' ? 'algo' : 'indicator';
  const referral_readiness = rawReferral.includes('more') ? 'need_more_information' : rawReferral === 'no' ? 'no' : 'yes';
  const funding_readiness = rawFunding.includes('demo') ? 'after_demo' : rawFunding.includes('not') ? 'not_at_moment' : 'now';
  const rawFund = (mapped['fund_amount'] || '').trim();
  let fund_amount: number | null = null;
  const errors: string[] = [];
  if (!full_name) errors.push('Name missing');
  if (!mobile_number) errors.push('Mobile missing');
  if (!email) errors.push('Email missing');
  if (!state) errors.push('State missing');
  if (rawFund) {
    const fundNum = parseFloat(rawFund.replace(/[$,\s]/g, ''));
    if (!isNaN(fundNum) && fundNum >= 0) {
      fund_amount = fundNum;
    } else {
      errors.push('Fund amount must be a number');
    }
  }
  return {
    full_name, mobile_number, email, state, trading_product, service_interest, referral_readiness, funding_readiness, status, notes, fund_amount,
    _valid: errors.length === 0,
    _error: errors.join(', '),
  };
}

function BulkUploadModal({ onClose, onUpload }: {
  onClose: () => void;
  onUpload: (rows: NewLeadForm[]) => Promise<{ success: number; failed: number }>;
}) {
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [columnHeaders, setColumnHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [fileName, setFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: number; failed: number } | null>(null);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsedRows = useMemo(
    () => rawRows.map((row) => parseRowWithMapping(row, columnMapping)),
    [rawRows, columnMapping],
  );

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handleFile = async (file: File) => {
    setParsing(true);
    setError('');
    setUploadResult(null);
    setRawRows([]);
    setColumnHeaders([]);
    setColumnMapping({});
    setFileName(file.name);

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
      if (json.length === 0) {
        setError('No data rows found in the file. Make sure your sheet has headers and at least one row of data.');
        return;
      }
      const headers = Array.from(new Set(json.flatMap((row) => Object.keys(row))));
      setRawRows(json);
      setColumnHeaders(headers);
      setColumnMapping(autoSuggestMapping(headers));
    } catch {
      setError('Could not read this file. Please upload a valid Excel (.xlsx, .xls) or CSV file.');
    } finally {
      setParsing(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const downloadTemplate = () => {
    const template = [
      { 'Full Name': 'Rahul Sharma', 'Mobile Number': '+91 98765 43210', Email: 'rahul@example.com', State: 'Maharashtra', 'Service Interest': 'Both Services', 'Referral Readiness': 'Yes', 'Funding Readiness': 'Now', 'Fund Amount': '5000', Status: 'New', Notes: 'Interested in both services' },
      { 'Full Name': 'Priya Patel', 'Mobile Number': '+91 87654 32109', Email: 'priya@example.com', State: 'Gujarat', 'Service Interest': 'TradingView Premium', 'Referral Readiness': 'Need more information', 'Funding Readiness': 'After demo', 'Fund Amount': '', Status: 'Interested', Notes: 'Wants to see demo first' },
      { 'Full Name': 'Amit Singh', 'Mobile Number': '+91 99887 76655', Email: 'amit@example.com', State: 'Delhi', 'Service Interest': 'Trading Algo', 'Referral Readiness': 'Yes', 'Funding Readiness': 'Now', 'Fund Amount': '10000', Status: 'Called - Responded', Notes: 'Ready to start immediately' },
      { 'Full Name': 'Sneha Reddy', 'Mobile Number': '+91 90123 45678', Email: 'sneha@example.com', State: 'Telangana', 'Service Interest': 'Trading Algo', 'Referral Readiness': 'No', 'Funding Readiness': 'Not at the moment', 'Fund Amount': '500', Status: 'Not Interested', Notes: 'Will revisit next quarter' },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');
    XLSX.writeFile(wb, 'leads-import-template.xlsx');
  };

  const validRows = parsedRows.filter((r) => r._valid);
  const invalidRows = parsedRows.filter((r) => !r._valid);

  const mappedTargets = new Set(Object.values(columnMapping).filter(Boolean));
  const missingRequired = TARGET_FIELDS
    .filter((f) => f.required && !mappedTargets.has(f.key))
    .map((f) => f.label);

  const handleMappingChange = (header: string, target: string) => {
    setColumnMapping((prev) => {
      const next = { ...prev };
      if (target) {
        for (const [h, t] of Object.entries(next)) {
          if (t === target && h !== header) next[h] = '';
        }
      }
      next[header] = target;
      return next;
    });
  };

  const handleUpload = async () => {
    if (validRows.length === 0 || uploading) return;
    setUploading(true);
    setError('');
    const forms: NewLeadForm[] = validRows.map((r) => ({
      full_name: r.full_name,
      mobile_number: r.mobile_number,
      email: r.email,
      state: r.state,
      trading_product: r.trading_product,
      service_interest: r.service_interest,
      referral_readiness: r.referral_readiness,
      funding_readiness: r.funding_readiness,
      status: r.status,
      notes: r.notes,
      fund_amount: r.fund_amount,
    }));
    const result = await onUpload(forms);
    setUploadResult(result);
    setUploading(false);
    if (result.failed > 0 && result.success === 0) {
      setError('Upload failed. Please check your data and try again.');
    }
  };

  const handleReset = () => {
    setRawRows([]);
    setColumnHeaders([]);
    setColumnMapping({});
    setFileName('');
    setUploadResult(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
      <div className="crm-drawer-overlay" onClick={onClose} />
      <div className="crm-bulk-modal">
        <div className="crm-add-lead-header">
          <div className="crm-add-lead-title">
            <div className="crm-bulk-icon">
              <Upload size={22} />
            </div>
            <div>
              <h2>Bulk Upload Leads</h2>
              <p>Import leads from an Excel or CSV file</p>
            </div>
          </div>
          <button className="crm-drawer-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="crm-bulk-body">
          {uploadResult ? (
            <div className="crm-bulk-success">
              <div className="crm-bulk-success-icon">
                <CheckIcon size={48} />
              </div>
              <h3>Upload Complete</h3>
              <p>
                <strong>{uploadResult.success}</strong> lead{uploadResult.success !== 1 ? 's' : ''} imported successfully
                {uploadResult.failed > 0 && <>, {uploadResult.failed} failed</>}
              </p>
              <div className="crm-bulk-success-actions">
                <button className="crm-add-lead-cancel" onClick={handleReset}>
                  Upload Another File
                </button>
                <button className="crm-add-lead-submit" onClick={onClose}>
                  Done
                </button>
              </div>
            </div>
          ) : parsing ? (
            <div className="crm-bulk-parsing">
              <Loader2 size={32} className="crm-spin" />
              <p>Reading {fileName}...</p>
            </div>
          ) : rawRows.length === 0 ? (
            <>
              <div
                className={`crm-bulk-dropzone ${dragOver ? 'crm-bulk-drop-active' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="crm-bulk-dropzone-icon">
                  <FileSpreadsheet size={40} />
                </div>
                <h3>Drop your file here or click to browse</h3>
                <p>Supports .xlsx, .xls, and .csv files</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleInputChange}
                  style={{ display: 'none' }}
                />
              </div>

              <div className="crm-bulk-help">
                <h4>Required Columns</h4>
                <p>Your file must have these column headers (names can vary slightly):</p>
                <div className="crm-bulk-columns">
                  <span className="crm-bulk-col-tag">Full Name *</span>
                  <span className="crm-bulk-col-tag">Mobile Number *</span>
                  <span className="crm-bulk-col-tag">Email *</span>
                  <span className="crm-bulk-col-tag">State *</span>
                  <span className="crm-bulk-col-tag">Fund Amount</span>
                  <span className="crm-bulk-col-tag">Service Interest</span>
                  <span className="crm-bulk-col-tag">Referral Readiness</span>
                  <span className="crm-bulk-col-tag">Funding Readiness</span>
                  <span className="crm-bulk-col-tag">Status</span>
                  <span className="crm-bulk-col-tag">Notes</span>
                </div>
                <p className="crm-bulk-hint">
                  Service Interest accepts: "Trading Algo", "TradingView Premium", or "Both Services" (defaults to Trading Algo)<br />
                  Referral Readiness accepts: Yes, Need more information, or No. Funding Readiness accepts: Now, After demo, or Not at the moment.<br />
                  Status accepts: New, Called - No Response, Called - Responded, Interested, Not Interested, Converted (defaults to New)
                </p>
                <button className="crm-bulk-template-btn" onClick={downloadTemplate}>
                  <FileText size={16} /> Download Template
                </button>
              </div>

              {error && <div className="crm-error">{error}</div>}
            </>
          ) : (
            <>
              <div className="crm-bulk-file-info">
                <div className="crm-bulk-file-info-left">
                  <FileSpreadsheet size={20} />
                  <span>{fileName}</span>
                </div>
                <div className="crm-bulk-file-info-right">
                  <span className="crm-bulk-stat crm-bulk-stat-valid">{validRows.length} valid</span>
                  {invalidRows.length > 0 && (
                    <span className="crm-bulk-stat crm-bulk-stat-invalid">{invalidRows.length} with errors</span>
                  )}
                  <button className="crm-bulk-change-file" onClick={handleReset}>Change File</button>
                </div>
              </div>

              <div className="crm-bulk-mapping-section">
                <div className="crm-bulk-mapping-header">
                  <h4>Map Your Columns</h4>
                  <p>We auto-matched your columns — review and adjust if needed.</p>
                </div>
                <div className="crm-bulk-mapping-list">
                  {columnHeaders.map((header) => {
                    const target = columnMapping[header] || '';
                    const sample = rawRows[0]?.[header];
                    const sampleStr = sample != null && String(sample).trim() ? String(sample).trim().slice(0, 40) : '';
                    return (
                      <div key={header} className={`crm-bulk-mapping-row ${target ? 'crm-bulk-mapping-matched' : ''}`}>
                        <div className="crm-bulk-mapping-col">
                          {target && <CheckIcon size={14} className="crm-bulk-mapping-check" />}
                          <span className="crm-bulk-mapping-col-label">{header}</span>
                        </div>
                        <span className="crm-bulk-mapping-sample">{sampleStr || '—'}</span>
                        <select
                          className={`crm-bulk-mapping-select ${target ? '' : 'crm-bulk-mapping-unmapped'}`}
                          value={target}
                          onChange={(e) => handleMappingChange(header, e.target.value)}
                        >
                          <option value="">Do not import</option>
                          {TARGET_FIELDS.map((f) => (
                            <option key={f.key} value={f.key}>{f.label}{f.required ? ' *' : ''}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
                {missingRequired.length > 0 && (
                  <div className="crm-bulk-mapping-warning">
                    <AlertTriangle size={14} />
                    <span>Required fields not mapped: {missingRequired.join(', ')}</span>
                  </div>
                )}
              </div>

              <div className="crm-bulk-preview-scroll">
                <table className="crm-bulk-preview-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>Mobile</th>
                      <th>Email</th>
                      <th>State</th>
                      <th>Product</th>
                      <th>Fund $</th>
                      <th>Service</th>
                      <th>Referral</th>
                      <th>Funding</th>
                      <th>Status</th>
                      <th>Notes</th>
                      <th>Issues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 100).map((row, i) => (
                      <tr key={i} className={row._valid ? '' : 'crm-bulk-row-invalid'}>
                        <td className="crm-bulk-row-num">{i + 1}</td>
                        <td>{row.full_name || <span className="crm-bulk-missing">—</span>}</td>
                        <td>{row.mobile_number || <span className="crm-bulk-missing">—</span>}</td>
                        <td>{row.email || <span className="crm-bulk-missing">—</span>}</td>
                        <td>{row.state || <span className="crm-bulk-missing">—</span>}</td>
                        <td>{row.trading_product === 'algo' ? 'Algo' : row.trading_product === 'both' ? 'Both' : 'TV Premium'}</td>
                        <td>{row.fund_amount != null ? `${row.fund_amount.toLocaleString('en-US')}` : <span className="crm-bulk-missing">—</span>}</td>
                        <td>{SERVICE_LABELS[row.service_interest] || row.service_interest || <span className="crm-bulk-missing">—</span>}</td>
                        <td className={`crm-bulk-qual-cell crm-bulk-qual-${readinessTone(row.referral_readiness)}`}>{REFERRAL_LABELS[row.referral_readiness] || row.referral_readiness}</td>
                        <td className={`crm-bulk-qual-cell crm-bulk-qual-${readinessTone(row.funding_readiness)}`}>{FUNDING_LABELS[row.funding_readiness] || row.funding_readiness}</td>
                        <td>{DEFAULT_PIPELINE_STAGES.find((s) => s.key === row.status)?.label || row.status}</td>
                        <td className="crm-bulk-notes-cell">{row.notes || '—'}</td>
                        <td>
                          {row._valid
                            ? <CheckIcon size={16} className="crm-bulk-check" />
                            : <span className="crm-bulk-error-text">{row._error}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedRows.length > 100 && (
                  <p className="crm-bulk-preview-more">Showing first 100 of {parsedRows.length} rows</p>
                )}
              </div>

              {error && <div className="crm-error">{error}</div>}

              <div className="crm-add-lead-actions">
                <button type="button" className="crm-add-lead-cancel" onClick={handleReset} disabled={uploading}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="crm-add-lead-submit"
                  onClick={handleUpload}
                  disabled={validRows.length === 0 || uploading}
                >
                  {uploading ? <Loader2 size={18} className="crm-spin" /> : <Upload size={18} />}
                  {uploading ? 'Uploading...' : `Import ${validRows.length} Lead${validRows.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ===================== Pipeline (Kanban) View =====================
function PipelineView({ leads, onLeadClick, onStatusChange, formatDate, assigneeMap, stages }: {
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
  onStatusChange: (id: string, updates: Partial<Lead>) => void;
  formatDate: (iso: string) => string;
  assigneeMap: Record<string, string>;
  stages: { key: LeadStatus; label: string; icon: React.ReactNode; color: string }[];
}) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<LeadStatus | null>(null);

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    setDraggedId(leadId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, status: LeadStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(status);
  };

  const handleDrop = (e: React.DragEvent, status: LeadStatus) => {
    e.preventDefault();
    if (draggedId) {
      onStatusChange(draggedId, { status, last_contacted_at: new Date().toISOString() });
      setDraggedId(null);
      setDropTarget(null);
    }
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDropTarget(null);
  };

  return (
    <div className="crm-pipeline-scroll">
      <div className="crm-pipeline-board">
        {stages.map((stage) => {
          const colors = STAGE_COLORS[stage.color];
          const stageLeads = leads.filter((l) => l.status === stage.key);
          const stageFund = stageLeads.reduce((sum, l) => sum + (l.fund_amount || 0), 0);
          return (
            <div
              key={stage.key}
              className={`crm-pipeline-column ${dropTarget === stage.key ? 'crm-drop-active' : ''}`}
              onDragOver={(e) => handleDragOver(e, stage.key)}
              onDrop={(e) => handleDrop(e, stage.key)}
            >
              <div className="crm-pipeline-col-header" style={{ background: colors.bg, borderBottom: `1px solid ${colors.border}` }}>
                <div className="crm-pipeline-col-title">
                  <span className="crm-pipeline-dot" style={{ background: colors.dot }} />
                  <span style={{ color: colors.text }}>{stage.icon} {stage.label}</span>
                </div>
                <span className="crm-pipeline-count" style={{ background: colors.dot, color: 'var(--bg-card)' }}>{stageLeads.length}</span>
              </div>
              {stageFund > 0 && (
                <div style={{ padding: '6px 12px', fontSize: '0.7rem', fontWeight: 700, color: '#16a34a', background: 'rgba(22,163,74,0.04)', borderBottom: '1px solid var(--border-subtle)' }}>
                  ${stageFund.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} total
                </div>
              )}
              <div className="crm-pipeline-col-body">
                {stageLeads.length === 0 ? (
                  <div className="crm-pipeline-empty">No leads here</div>
                ) : (
                  stageLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className="crm-pipeline-card"
                      draggable
                      onDragStart={(e) => handleDragStart(e, lead.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => onLeadClick(lead)}
                      style={draggedId === lead.id ? { opacity: 0.4 } : undefined}
                    >
                      <div className="crm-pipeline-card-top">
                        <div className="crm-lead-avatar crm-avatar-sm" style={{ background: colors.cardBg, color: colors.text, border: `1px solid ${colors.border}` }}>
                          {lead.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                        <div className="crm-pipeline-card-info">
                          <strong>{lead.full_name}</strong>
                          <span>{lead.mobile_number}</span>
                        </div>
                      </div>
                      <div className="crm-pipeline-card-meta">
                        <span className={`crm-product-tag crm-product-sm ${lead.trading_product}`}>
                          {lead.trading_product === 'algo' ? 'Algo' : 'TV'}
                        </span>
                        {lead.assigned_to && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.68rem', fontWeight: 600, color: '#0f766e' }}>
                            <Shuffle size={10} /> {assigneeMap[lead.assigned_to]?.split('@')[0] || 'Assigned'}
                          </span>
                        )}
                        {lead.fund_amount != null && (
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: lead.fund_amount >= 500 ? '#16a34a' : '#ef4444' }}>
                            ${lead.fund_amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                        )}
                        <span className="crm-pipeline-date">{formatDate(lead.created_at)}</span>
                      </div>
                      {(lead.tags && lead.tags.length > 0) && (
                        <div className="crm-pipeline-card-tags">
                          {lead.tags.slice(0, 3).map((t) => (
                            <span key={t} className="crm-tag-mini">{t}</span>
                          ))}
                        </div>
                      )}
                      {lead.notes && (
                        <div className="crm-pipeline-card-notes">
                          <StickyNote size={12} /> {lead.notes.length > 40 ? lead.notes.slice(0, 40) + '...' : lead.notes}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===================== Lead Detail Drawer =====================
// ===================== Qualification Section =====================
const REFERRAL_LABELS: Record<string, string> = {
  yes: 'Yes, ready to open an account',
  need_more_information: 'Needs more information',
  no: 'Not interested',
};

const FUNDING_LABELS: Record<string, string> = {
  now: 'Can fund now',
  after_demo: 'After using a demo account',
  not_at_moment: 'Not at the moment',
};

const SERVICE_LABELS: Record<string, string> = {
  algo: 'Algo Trading Access',
  indicator: 'TradingView Premium',
  both: 'Both Services',
};

function readinessTone(value: string): 'positive' | 'caution' | 'negative' {
  if (value === 'yes' || value === 'now') return 'positive';
  if (value === 'no' || value === 'not_at_moment') return 'negative';
  return 'caution';
}

function QualificationSection({ lead }: { lead: Lead }) {
  const cd = lead.custom_data;
  const knownKeys = new Set(['service_interest', 'referral_readiness', 'funding_readiness']);

  const standardAnswers: { question: string; value: string; tone?: 'positive' | 'caution' | 'negative' }[] = [];

  const productLabel = lead.trading_product === 'algo' ? 'Algo Trading Access'
    : lead.trading_product === 'tradingview_premium' ? 'TradingView Premium'
    : lead.trading_product === 'both' ? 'Both Services'
    : lead.trading_product;

  standardAnswers.push({ question: 'Service interest', value: productLabel });

  if (lead.fund_amount != null) {
    standardAnswers.push({ question: 'Fund amount', value: `${Number(lead.fund_amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} USD` });
  }

  const serviceInterest = typeof cd?.service_interest === 'string' ? cd.service_interest : '';
  if (serviceInterest) {
    standardAnswers.push({ question: 'Service selected', value: SERVICE_LABELS[serviceInterest] || serviceInterest });
  }

  const referral = typeof cd?.referral_readiness === 'string' ? cd.referral_readiness : '';
  if (referral) {
    standardAnswers.push({ question: 'Ready to open account via referral link?', value: REFERRAL_LABELS[referral] || referral, tone: readinessTone(referral) });
  }

  const funding = typeof cd?.funding_readiness === 'string' ? cd.funding_readiness : '';
  if (funding) {
    standardAnswers.push({ question: 'When can they fund at least $500?', value: FUNDING_LABELS[funding] || funding, tone: readinessTone(funding) });
  }

  const customAnswers: { question: string; value: string }[] = [];
  if (cd && typeof cd === 'object') {
    for (const [key, val] of Object.entries(cd)) {
      if (knownKeys.has(key)) continue;
      if (val == null || val === '') continue;
      const display = typeof val === 'string' ? val : typeof val === 'number' || typeof val === 'boolean' ? String(val) : JSON.stringify(val);
      customAnswers.push({ question: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), value: display });
    }
  }

  const hasAnswers = standardAnswers.length > 1 || customAnswers.length > 0;

  if (!hasAnswers) {
    return (
      <div className="crm-drawer-section">
        <label className="crm-drawer-label"><HelpCircle size={14} style={{ display: 'inline', marginRight: '4px' }} /> QUALIFICATION ANSWERS</label>
        <div className="crm-qual-empty">
          <HelpCircle size={24} style={{ color: 'var(--text-dark)', marginBottom: '4px' }} />
          <p>No qualification answers recorded for this lead.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="crm-drawer-section">
      <label className="crm-drawer-label"><HelpCircle size={14} style={{ display: 'inline', marginRight: '4px' }} /> QUALIFICATION ANSWERS</label>
      <div className="crm-qual-card">
        {standardAnswers.map((a, i) => (
          <div key={i} className="crm-qual-row">
            <span className="crm-qual-question">{a.question}</span>
            <span className={`crm-qual-answer ${a.tone ? `crm-qual-tone-${a.tone}` : ''}`}>{a.value}</span>
          </div>
        ))}
        {customAnswers.length > 0 && (
          <>
            {customAnswers.map((a, i) => (
              <div key={`c${i}`} className="crm-qual-row crm-qual-custom-row">
                <span className="crm-qual-question">{a.question}</span>
                <span className="crm-qual-answer">{a.value}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function LeadDetailDrawer({ lead, onClose, onUpdate, onDelete, formatDate, onSendEmail, onCall, setupCostPerClient, stages }: {
  lead: Lead;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Lead>) => void;
  onDelete: (id: string) => void;
  formatDate: (iso: string) => string;
  onSendEmail: (lead: Lead) => void;
  onCall: (number: string) => void;
  setupCostPerClient: number;
  stages: { key: LeadStatus; label: string; icon: React.ReactNode; color: string }[];
}) {
  const [tagInput, setTagInput] = useState('');
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [leadNotes, setLeadNotes] = useState<LeadNote[]>([]);
  const [leadNotesLoading, setLeadNotesLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [fundInput, setFundInput] = useState(lead.fund_amount != null ? String(lead.fund_amount) : '');
  const [purchaseInput, setPurchaseInput] = useState(lead.purchase_value != null ? String(lead.purchase_value) : '');
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [reminderNote, setReminderNote] = useState('');
  const [savingReminder, setSavingReminder] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(lead.full_name);
  const [editEmail, setEditEmail] = useState(lead.email);
  const [editMobile, setEditMobile] = useState(lead.mobile_number);
  const [editState, setEditState] = useState(lead.state);
  const [editProduct, setEditProduct] = useState(lead.trading_product);
  const [editMetaLeadId, setEditMetaLeadId] = useState(lead.meta_lead_id || '');
  const [editSource, setEditSource] = useState(lead.lead_source || 'Manual Entry');
  const [savingInfo, setSavingInfo] = useState(false);
  const [brokers, setBrokers] = useState<{ id: string; name: string; website: string | null; logo_url: string | null }[]>([]);

  useEffect(() => {
    (async () => {
      const { data: brokerData } = await supabase
        .from('brokers')
        .select('id, name, website, logo_url')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (brokerData) setBrokers(brokerData as { id: string; name: string; website: string | null; logo_url: string | null }[]);
    })();
  }, []);

  useEffect(() => {
    setEditName(lead.full_name);
    setEditEmail(lead.email);
    setEditMobile(lead.mobile_number);
    setEditState(lead.state);
    setEditProduct(lead.trading_product);
    setEditMetaLeadId(lead.meta_lead_id || '');
    setEditSource(lead.lead_source || 'Manual Entry');
  }, [lead.id, lead.full_name, lead.email, lead.mobile_number, lead.state, lead.trading_product, lead.meta_lead_id, lead.lead_source]);

  const handleSaveInfo = () => {
    setSavingInfo(true);
    const updates: Partial<Lead> = {
      full_name: editName.trim() || lead.full_name,
      email: editEmail.trim() || lead.email,
      mobile_number: editMobile.trim() || lead.mobile_number,
      state: editState.trim() || lead.state,
      trading_product: editProduct,
      meta_lead_id: editMetaLeadId.trim() || null,
      lead_source: editSource,
    };
    onUpdate(lead.id, updates);
    logActivity('lead_edit', `Lead info updated: ${updates.full_name}`, { fields: ['full_name', 'email', 'mobile_number', 'state', 'trading_product', 'meta_lead_id', 'lead_source'] });
    setSavingInfo(false);
    setIsEditing(false);
  };

  const cancelEdit = () => {
    setEditName(lead.full_name);
    setEditEmail(lead.email);
    setEditMobile(lead.mobile_number);
    setEditState(lead.state);
    setEditProduct(lead.trading_product);
    setEditMetaLeadId(lead.meta_lead_id || '');
    setEditSource(lead.lead_source || 'Manual Entry');
    setIsEditing(false);
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('team_members')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: true });
      if (data) setTeamMembers(data as TeamMember[]);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setActivitiesLoading(true);
      const { data } = await supabase
        .from('lead_activities')
        .select('*')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) setActivities(data as LeadActivity[]);
      setActivitiesLoading(false);
    })();
  }, [lead.id]);

  const logActivity = useCallback(async (activityType: string, description: string, metadata: Record<string, unknown> = {}) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) return;
    await supabase.from('lead_activities').insert({
      user_id: userId,
      lead_id: lead.id,
      activity_type: activityType,
      description,
      metadata,
    });
    setActivities((prev) => [{ id: crypto.randomUUID(), lead_id: lead.id, activity_type: activityType, description, metadata, created_at: new Date().toISOString() }, ...prev]);
  }, [lead.id]);

  const stage = stages.find((s) => s.key === lead.status)!;
  const colors = STAGE_COLORS[stage.color];

  const handleStatusChange = (status: LeadStatus) => {
    const oldStatus = lead.status;
    onUpdate(lead.id, { status, last_contacted_at: new Date().toISOString() });
    if (oldStatus !== status) {
      logActivity('status_change', `Status changed from "${oldStatus.replace(/_/g, ' ')}" to "${status.replace(/_/g, ' ')}"`, { old_status: oldStatus, new_status: status });
    }
  };

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    const currentTags = lead.tags || [];
    if (currentTags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) return;
    onUpdate(lead.id, { tags: [...currentTags, trimmed] });
    logActivity('tag_added', `Tag "${trimmed}" added`, { tag: trimmed });
    setTagInput('');
    setShowTagSuggestions(false);
  };

  const removeTag = (tag: string) => {
    onUpdate(lead.id, { tags: (lead.tags || []).filter((t) => t !== tag) });
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag(tagInput);
    }
  };

  const fetchLeadNotes = useCallback(async () => {
    setLeadNotesLoading(true);
    const { data } = await supabase
      .from('lead_notes')
      .select('*')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false });
    if (data) setLeadNotes(data as LeadNote[]);
    setLeadNotesLoading(false);
  }, [lead.id]);

  useEffect(() => {
    fetchLeadNotes();
  }, [fetchLeadNotes]);

  const saveNotes = async () => {
    const trimmed = notesValue.trim();
    if (!trimmed) return;
    setSavingNotes(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) { setSavingNotes(false); return; }
    const { data, error } = await supabase
      .from('lead_notes')
      .insert({
        lead_id: lead.id,
        note: trimmed,
        stage_at_time: lead.status,
      })
      .select()
      .single();
    if (!error && data) {
      setLeadNotes((prev) => [data as LeadNote, ...prev]);
      onUpdate(lead.id, { notes: trimmed });
      logActivity('note', 'Note added to timeline', { note_preview: trimmed.slice(0, 100) });
      setNotesValue('');
    }
    setSavingNotes(false);
  };

  const saveFund = () => {
    const parsed = parseFloat(fundInput);
    if (isNaN(parsed) || parsed < 0) {
      onUpdate(lead.id, { fund_amount: null });
    } else {
      onUpdate(lead.id, { fund_amount: parsed });
    }
  };

  const savePurchaseValue = () => {
    const parsed = parseFloat(purchaseInput);
    if (isNaN(parsed) || parsed < 0) {
      onUpdate(lead.id, { purchase_value: null });
    } else {
      onUpdate(lead.id, { purchase_value: parsed });
      logActivity('conversion', `Purchase value set to ${parsed.toFixed(2)}`, { purchase_value: parsed });
    }
  };

  const handleDelete = () => {
    setDeleting(true);
    onDelete(lead.id);
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('lead_followups')
        .select('*')
        .eq('lead_id', lead.id)
        .order('reminder_at', { ascending: true });
      if (data) setFollowups(data as FollowUp[]);
    })();
  }, [lead.id]);

  const handleCreateReminder = async () => {
    if (!reminderDate || !reminderTime) return;
    const reminderAt = new Date(`${reminderDate}T${reminderTime}`).toISOString();
    setSavingReminder(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) { setSavingReminder(false); return; }

    const { data, error: insertError } = await supabase
      .from('lead_followups')
      .insert({
        user_id: userId,
        lead_id: lead.id,
        title: `Follow up: ${lead.full_name}`,
        note: reminderNote.trim() || null,
        reminder_at: reminderAt,
        status: 'pending',
      })
      .select()
      .single();

    if (!insertError && data) {
      setFollowups((prev) => [...prev, data as FollowUp].sort((a, b) => new Date(a.reminder_at).getTime() - new Date(b.reminder_at).getTime()));
      logActivity('follow_up_created', `Follow-up reminder set for ${reminderDate} at ${reminderTime}`, { reminder_at: reminderAt });
      setReminderDate('');
      setReminderTime('');
      setReminderNote('');
      setShowReminderForm(false);
    }
    setSavingReminder(false);
  };

  const handleDeleteReminder = async (id: string) => {
    await supabase.from('lead_followups').delete().eq('id', id);
    setFollowups((prev) => prev.filter((f) => f.id !== id));
  };

  const handleDeleteNote = async (noteId: string) => {
    await supabase.from('lead_notes').delete().eq('id', noteId);
    setLeadNotes((prev) => prev.filter((n) => n.id !== noteId));
  };

  const handleMarkReminderDone = async (id: string) => {
    await supabase.from('lead_followups').update({ status: 'done', updated_at: new Date().toISOString() }).eq('id', id);
    setFollowups((prev) => prev.map((f) => f.id === id ? { ...f, status: 'done' } : f));
    logActivity('follow_up_done', 'Follow-up reminder marked as done', { followup_id: id });
  };

  const availableSuggestions = SUGGESTED_TAGS.filter(
    (s) => !(lead.tags || []).some((t) => t.toLowerCase() === s.toLowerCase())
  );

  const stageChanges = activities.filter((a) => a.activity_type === 'status_change');

  return (
    <>
      <div className="crm-drawer-overlay" onClick={onClose} />
      <div className="crm-drawer">
        {/* Header */}
        <div className="crm-drawer-header">
          <div className="crm-drawer-lead">
            <div className="crm-lead-avatar crm-avatar-lg" style={{ background: colors.cardBg, color: colors.text, border: `1px solid ${colors.border}` }}>
              {lead.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div>
              <h2>{lead.full_name}</h2>
              <p>Submitted {formatDate(lead.created_at)}</p>
            </div>
          </div>
          <button className="crm-drawer-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Current Status */}
        <div className="crm-drawer-section">
          <label className="crm-drawer-label">CURRENT STATUS</label>
          <span className="crm-status-badge crm-status-lg" style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}>
            {stage.icon} {stage.label}
          </span>
        </div>

        {/* Status Actions */}
        <div className="crm-drawer-section">
          <label className="crm-drawer-label">MOVE TO STAGE</label>
          <div className="crm-status-grid">
            {stages.map((s) => {
              const sc = STAGE_COLORS[s.color];
              const isActive = lead.status === s.key;
              return (
                <button
                  key={s.key}
                  className={`crm-status-btn ${isActive ? 'crm-status-btn-active' : ''}`}
                  style={isActive ? { background: sc.bg, borderColor: sc.dot, color: sc.text } : {}}
                  onClick={() => handleStatusChange(s.key)}
                >
                  {s.icon} {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Contact Info */}
        <div className="crm-drawer-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <label className="crm-drawer-label" style={{ marginBottom: 0 }}>CONTACT</label>
            {isEditing ? (
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={cancelEdit} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', border: '1px solid var(--border-subtle)', borderRadius: '6px', background: 'var(--bg-card)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dark)', cursor: 'pointer' }}>
                  <X size={13} /> Cancel
                </button>
                <button onClick={handleSaveInfo} disabled={savingInfo} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', border: 'none', borderRadius: '6px', background: '#2563eb', fontSize: '0.75rem', fontWeight: 600, color: 'var(--bg-card)', cursor: 'pointer' }}>
                  {savingInfo ? <Loader2 size={13} className="crm-spin" /> : <Save size={13} />} Save
                </button>
              </div>
            ) : (
              <button onClick={() => setIsEditing(true)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', border: '1px solid var(--border-subtle)', borderRadius: '6px', background: 'var(--bg-light)', fontSize: '0.75rem', fontWeight: 600, color: '#2563eb', cursor: 'pointer', transition: 'all 0.15s' }} onMouseEnter={(e) => { e.currentTarget.style.background = '#2563eb'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-light)'; e.currentTarget.style.color = '#2563eb'; }}>
                <Edit3 size={13} /> Edit Info
              </button>
            )}
          </div>
          {isEditing ? (
            <div className="crm-add-lead-grid">
              <label className="crm-add-lead-field">
                <span>Full Name</span>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Full name" />
              </label>
              <label className="crm-add-lead-field">
                <span>Mobile Number</span>
                <input type="tel" value={editMobile} onChange={(e) => setEditMobile(e.target.value)} placeholder="Phone number" />
              </label>
              <label className="crm-add-lead-field">
                <span>Email</span>
                <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="Email address" />
              </label>
              <label className="crm-add-lead-field">
                <span>State</span>
                <input type="text" value={editState} onChange={(e) => setEditState(e.target.value)} placeholder="State" />
              </label>
              <label className="crm-add-lead-field">
                <span>Trading Product</span>
                <select value={editProduct} onChange={(e) => setEditProduct(e.target.value as Lead['trading_product'])} style={{ cursor: 'pointer' }}>
                  <option value="algo">Trading Algo</option>
                  <option value="tradingview_premium">TradingView Premium Indicator</option>
                  <option value="both">Both Services</option>
                </select>
              </label>
              <label className="crm-add-lead-field">
                <span>Meta Lead ID</span>
                <input type="text" value={editMetaLeadId} onChange={(e) => setEditMetaLeadId(e.target.value)} placeholder="Auto-captured from Facebook (optional)" />
              </label>
              <label className="crm-add-lead-field">
                <span>Lead Source</span>
                <select value={editSource} onChange={(e) => setEditSource(e.target.value)} style={{ cursor: 'pointer' }}>
                  {SOURCE_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>
          ) : (
            <div className="crm-drawer-contacts">
              <button type="button" className="crm-drawer-contact-item" onClick={() => onCall(lead.mobile_number)} style={{ cursor: 'pointer', font: 'inherit' }}>
                <Phone size={16} /> <span>{lead.mobile_number}</span>
              </button>
              <a href={`mailto:${lead.email}`} className="crm-drawer-contact-item">
                <Mail size={16} /> <span>{lead.email}</span>
              </a>
              <div className="crm-drawer-contact-item crm-contact-static">
                <MapPin size={16} /> <span>{lead.state}</span>
              </div>
              <div className="crm-drawer-contact-item crm-contact-static">
                {lead.trading_product === 'algo' ? <Bot size={16} /> : <BarChart3 size={16} />}
                <select
                  value={lead.trading_product}
                  onChange={(e) => onUpdate(lead.id, { trading_product: e.target.value as Lead['trading_product'] })}
                  aria-label="Trading product"
                  style={{ flex: 1, border: 0, background: 'transparent', color: 'var(--text-muted)', font: 'inherit', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
                >
                  <option value="algo">Trading Algo</option>
                  <option value="tradingview_premium">TradingView Premium Indicator</option>
                  <option value="both">Both Services</option>
                </select>
              </div>
              <div className="crm-drawer-contact-item crm-contact-static">
                <DollarSign size={16} style={{ color: '#16a34a' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={fundInput}
                    onChange={(e) => setFundInput(e.target.value)}
                    onBlur={() => saveFund()}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    placeholder="0"
                    aria-label="Fund amount"
                    style={{ width: '120px', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '4px 8px', font: 'inherit', fontWeight: 700, color: '#16a34a', outline: 'none' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>USD</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Lead Source (editable when not editing info) */}
        {!isEditing && (
        <div className="crm-drawer-section">
          <label className="crm-drawer-label">LEAD SOURCE</label>
          <div className="crm-drawer-contact-item crm-contact-static" style={{ background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.12)', borderRadius: '8px', padding: '10px 12px' }}>
            <SourceLogo source={lead.lead_source || 'Landing Page'} size={18} />
            <select
              value={lead.lead_source || 'Manual Entry'}
              onChange={(e) => {
                onUpdate(lead.id, { lead_source: e.target.value });
                logActivity('lead_source_change', `Lead source changed to "${e.target.value}"`, { lead_source: e.target.value });
              }}
              aria-label="Lead source"
              style={{ flex: 1, border: 0, background: 'transparent', color: 'var(--text-muted)', font: 'inherit', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
            >
              {SOURCE_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        )}

        {/* Meta Lead ID (read-only when not editing) */}
        {!isEditing && (
        <div className="crm-drawer-section">
          <label className="crm-drawer-label">META LEAD ID</label>
          <div className="crm-drawer-contact-item crm-contact-static">
            <TrendingUp size={16} style={{ color: '#1877F2' }} />
            <input
              type="text"
              value={lead.meta_lead_id || ''}
              onChange={(e) => onUpdate(lead.id, { meta_lead_id: e.target.value })}
              placeholder="Auto-captured from Facebook Lead Ads (optional)"
              aria-label="Meta Lead ID"
              style={{ flex: 1, border: 0, background: 'transparent', color: 'var(--text-muted)', font: 'inherit', fontWeight: 600, outline: 'none' }}
            />
          </div>
        </div>
        )}

        {/* Purchase Value + Setup Cost (only for converted leads) */}
        {lead.status === 'converted' && (
        <div className="crm-drawer-section">
          <label className="crm-drawer-label">PURCHASE VALUE</label>
          <div className="crm-drawer-contact-item crm-contact-static" style={{ background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.15)', borderRadius: '8px', padding: '10px 12px' }}>
            <DollarSign size={16} style={{ color: '#16a34a' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
              <input
                type="number"
                min="0"
                step="50"
                value={purchaseInput}
                onChange={(e) => setPurchaseInput(e.target.value)}
                onBlur={() => savePurchaseValue()}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                placeholder="0"
                aria-label="Purchase value"
                style={{ width: '120px', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '4px 8px', font: 'inherit', fontWeight: 700, color: '#16a34a', outline: 'none' }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>USD</span>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-dark)', marginLeft: 'auto', textAlign: 'right', maxWidth: '120px' }}>Sent to Meta as Purchase event value</span>
          </div>
          <label className="crm-drawer-label" style={{ marginTop: '12px' }}>SETUP COST</label>
          <div className="crm-drawer-contact-item crm-contact-static" style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.15)', borderRadius: '8px', padding: '10px 12px' }}>
            <DollarSign size={16} style={{ color: '#2563eb' }} />
            <span style={{ fontWeight: 700, color: '#2563eb', fontSize: '0.9rem' }}>${setupCostPerClient.toFixed(2)}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dark)', marginLeft: 'auto' }}>Auto-counted on conversion</span>
          </div>
        </div>
        )}

        {/* Assigned To */}
        <div className="crm-drawer-section">
          <label className="crm-drawer-label">ASSIGNED TO</label>
          <div className="crm-drawer-contact-item crm-contact-static">
            <Shuffle size={16} style={{ color: '#0f766e' }} />
            <select
              value={lead.assigned_to || ''}
              onChange={(e) => onUpdate(lead.id, { assigned_to: e.target.value || null })}
              aria-label="Assigned to"
              style={{ flex: 1, border: 0, background: 'transparent', color: 'var(--text-muted)', font: 'inherit', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
            >
              <option value="">Unassigned</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>{m.full_name || m.email}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Broker Selection — visible when lead is interested, called_responded, or not_interested (unconverted but engaged) */}
        {(lead.status === 'interested' || lead.status === 'called_responded' || lead.status === 'not_interested' || lead.status === 'converted' || lead.status === 'called_no_response') && brokers.length > 0 && (
        <div className="crm-drawer-section">
          <label className="crm-drawer-label">BROKER</label>
          <div className="crm-drawer-contact-item crm-contact-static" style={{ background: 'rgba(37,99,235,0.04)', border: '1px solid rgba(37,99,235,0.12)', borderRadius: '8px', padding: '10px 12px' }}>
            <Building2 size={16} style={{ color: '#2563eb' }} />
            <select
              value={lead.broker_id || ''}
              onChange={(e) => {
                const brokerId = e.target.value || null;
                onUpdate(lead.id, { broker_id: brokerId });
                const brokerName = brokers.find((b) => b.id === brokerId)?.name || 'None';
                logActivity('broker_assigned', `Broker set to "${brokerName}"`, { broker_id: brokerId });
              }}
              aria-label="Broker"
              style={{ flex: 1, border: 0, background: 'transparent', color: 'var(--text-muted)', font: 'inherit', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
            >
              <option value="">No broker selected</option>
              {brokers.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>
        )}

        {/* Account Type & Partner Code — visible when a broker is selected */}
        {lead.broker_id && brokers.length > 0 && (
        <div className="crm-drawer-section">
          <label className="crm-drawer-label">ACCOUNT TRACKING</label>

          {/* Account Type */}
          <div className="crm-drawer-contact-item crm-contact-static" style={{ background: 'rgba(13,148,136,0.04)', border: '1px solid rgba(13,148,136,0.12)', borderRadius: '8px', padding: '10px 12px', marginBottom: '8px' }}>
            <UserCheck size={16} style={{ color: '#0d9488' }} />
            <select
              value={lead.account_type || ''}
              onChange={(e) => {
                const val = (e.target.value || null) as 'new_account' | 'existing_account' | null;
                onUpdate(lead.id, { account_type: val });
                logActivity('account_type_change', `Account type set to "${val === 'new_account' ? 'New Account' : val === 'existing_account' ? 'Existing Account' : 'None'}"`, { account_type: val });
              }}
              aria-label="Account type"
              style={{ flex: 1, border: 0, background: 'transparent', color: 'var(--text-muted)', font: 'inherit', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
            >
              <option value="">Account type — not set</option>
              <option value="new_account">New Account (client opened a new one)</option>
              <option value="existing_account">Existing Account (client already had one)</option>
            </select>
          </div>

          {/* Partner Code */}
          <div className="crm-drawer-contact-item crm-contact-static" style={{ background: 'rgba(37,99,235,0.04)', border: '1px solid rgba(37,99,235,0.12)', borderRadius: '8px', padding: '10px 12px' }}>
            <Hash size={16} style={{ color: '#2563eb' }} />
            <input
              type="text"
              value={lead.partner_code || ''}
              onChange={(e) => onUpdate(lead.id, { partner_code: e.target.value || null })}
              onBlur={() => logActivity('partner_code_change', `Partner code set to "${lead.partner_code || 'None'}"`, { partner_code: lead.partner_code })}
              placeholder="Partner / referral code"
              aria-label="Partner code"
              style={{ flex: 1, border: 0, background: 'transparent', color: 'var(--text-muted)', font: 'inherit', fontWeight: 600, outline: 'none' }}
            />
          </div>
        </div>
        )}

        {/* Qualification Answers */}
        <QualificationSection lead={lead} />

        {/* Tags */}
        <div className="crm-drawer-section">
          <label className="crm-drawer-label">TAGS</label>
          <div className="crm-tags-container">
            {(lead.tags || []).map((tag) => (
              <span key={tag} className="crm-tag-chip">
                <Tag size={11} /> {tag}
                <button onClick={() => removeTag(tag)} aria-label={`Remove ${tag}`}>
                  <X size={12} />
                </button>
              </span>
            ))}
            {(lead.tags || []).length === 0 && (
              <span className="crm-tag-empty">No tags yet</span>
            )}
          </div>
          <div className="crm-tag-input-wrap">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagInputKeyDown}
              onFocus={() => setShowTagSuggestions(true)}
              onBlur={() => setTimeout(() => setShowTagSuggestions(false), 150)}
              placeholder="Add a tag and press Enter..."
            />
            <button onClick={() => addTag(tagInput)} disabled={!tagInput.trim()} aria-label="Add tag">
              <Plus size={18} />
            </button>
          </div>
          {showTagSuggestions && availableSuggestions.length > 0 && (
            <div className="crm-tag-suggestions">
              {availableSuggestions.map((s) => (
                <button key={s} className="crm-tag-suggestion" onClick={() => addTag(s)}>
                  <Plus size={12} /> {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notes Timeline */}
        <div className="crm-drawer-section">
          <label className="crm-drawer-label"><StickyNote size={14} style={{ display: 'inline', marginRight: '4px' }} /> NOTES TIMELINE</label>
          <textarea
            className="crm-notes-textarea"
            value={notesValue}
            onChange={(e) => setNotesValue(e.target.value)}
            placeholder="Write a note about this lead — what was discussed, interest level, follow-up needed..."
            rows={3}
          />
          <button className="crm-btn-save-notes" onClick={saveNotes} disabled={savingNotes || !notesValue.trim()}>
            {savingNotes ? <Loader2 size={16} className="crm-spin" /> : <Plus size={16} />} {savingNotes ? 'Saving...' : 'Add Note'}
          </button>

          {leadNotesLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 0', color: 'var(--text-dark)', fontSize: '0.82rem' }}>
              <Loader2 size={16} className="crm-spin" /> Loading notes...
            </div>
          ) : leadNotes.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-dark)', fontSize: '0.82rem' }}>
              <StickyNote size={28} style={{ marginBottom: '6px', opacity: 0.3 }} />
              <p>No notes yet. Add your first note above — it will be saved with the date and time.</p>
            </div>
          ) : (
            <div className="crm-notes-timeline">
              {leadNotes.map((n, idx) => {
                const noteStage = stages.find((s) => s.key === n.stage_at_time);
                const noteColors = noteStage ? STAGE_COLORS[noteStage.color] : null;
                return (
                  <div key={n.id} className="crm-note-timeline-item">
                    {idx < leadNotes.length - 1 && <div className="crm-note-timeline-line" />}
                    <div className="crm-note-timeline-dot" style={noteColors ? { background: noteColors.bg, border: `2px solid ${noteColors.dot}` } : {}}>
                      <StickyNote size={12} style={noteColors ? { color: noteColors.text } : {}} />
                    </div>
                    <div className="crm-note-timeline-body">
                      <div className="crm-note-timeline-header">
                        {noteStage && (
                          <span className="crm-note-stage-badge" style={noteColors ? { background: noteColors.bg, color: noteColors.text, border: `1px solid ${noteColors.border}` } : {}}>
                            {noteStage.label}
                          </span>
                        )}
                        <span className="crm-note-timeline-time">
                          {new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at{' '}
                          {new Date(n.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                        </span>
                      </div>
                      <p className="crm-note-timeline-text">{n.note}</p>
                      <button className="crm-note-delete-btn" onClick={() => handleDeleteNote(n.id)} aria-label="Delete note" title="Delete this note">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Stage Timeline */}
        {stageChanges.length > 0 && (
          <div className="crm-drawer-section">
            <label className="crm-drawer-label"><Shuffle size={14} style={{ display: 'inline', marginRight: '4px' }} /> STAGE TIMELINE</label>
            <div className="crm-notes-timeline">
              {stageChanges.map((change, idx) => {
                const meta = change.metadata as Record<string, unknown>;
                const newStatus = meta.new_status as string;
                const oldStatus = meta.old_status as string;
                const newStage = stages.find((s) => s.key === newStatus);
                const oldStage = stages.find((s) => s.key === oldStatus);
                const newColors = newStage ? STAGE_COLORS[newStage.color] : null;
                return (
                  <div key={change.id} className="crm-note-timeline-item">
                    {idx < stageChanges.length - 1 && <div className="crm-note-timeline-line" />}
                    <div className="crm-note-timeline-dot" style={newColors ? { background: newColors.bg, border: `2px solid ${newColors.dot}` } : {}}>
                      <Shuffle size={12} style={newColors ? { color: newColors.text } : {}} />
                    </div>
                    <div className="crm-note-timeline-body">
                      <div className="crm-note-timeline-header">
                        <span className="crm-note-stage-badge" style={newColors ? { background: newColors.bg, color: newColors.text, border: `1px solid ${newColors.border}` } : {}}>
                          {newStage?.label || newStatus}
                        </span>
                        <span className="crm-note-timeline-time">
                          {new Date(change.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at{' '}
                          {new Date(change.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                        </span>
                      </div>
                      <p className="crm-note-timeline-text" style={{ fontSize: '0.78rem' }}>
                        Moved from <strong>{oldStage?.label || oldStatus}</strong> to <strong>{newStage?.label || newStatus}</strong>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Last Contacted */}
        {lead.last_contacted_at && (
          <div className="crm-drawer-section">
            <label className="crm-drawer-label">LAST CONTACTED</label>
            <span className="crm-date-tag">
              <Clock size={14} /> {formatDate(lead.last_contacted_at)}
            </span>
          </div>
        )}

        {/* Follow-up Reminders */}
        <div className="crm-drawer-section">
          <label className="crm-drawer-label">FOLLOW-UP REMINDERS</label>

          {followups.length > 0 && (
            <div className="crm-reminder-list">
              {followups.map((f) => {
                const isOverdue = f.status === 'pending' && new Date(f.reminder_at).getTime() < Date.now();
                const isSent = f.status === 'sent';
                const isDone = f.status === 'done';
                return (
                  <div key={f.id} className={`crm-reminder-item ${isOverdue ? 'crm-reminder-overdue' : ''} ${isDone ? 'crm-reminder-done' : ''}`}>
                    <div className="crm-reminder-icon-wrap">
                      {isSent ? <BellRing size={16} style={{ color: '#0088cc' }} /> :
                       isDone ? <CheckCircle2 size={16} style={{ color: '#22c55e' }} /> :
                       isOverdue ? <BellRing size={16} style={{ color: '#ef4444' }} /> :
                       <Bell size={16} style={{ color: '#f59e0b' }} />}
                    </div>
                    <div className="crm-reminder-content">
                      <span className="crm-reminder-date">{formatDate(f.reminder_at)} at {new Date(f.reminder_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                      {f.note && <span className="crm-reminder-note">{f.note}</span>}
                      <span className={`crm-reminder-badge ${isOverdue ? 'crm-badge-overdue' : ''} ${isSent ? 'crm-badge-sent' : ''} ${isDone ? 'crm-badge-done' : ''}`}>
                        {isOverdue ? 'Overdue - Email sent' : isSent ? 'Email sent' : isDone ? 'Done' : 'Pending'}
                      </span>
                    </div>
                    {!isDone && (
                      <button className="crm-reminder-done-btn" onClick={() => handleMarkReminderDone(f.id)} aria-label="Mark done" title="Mark as done">
                        <CheckCircle2 size={16} />
                      </button>
                    )}
                    <button className="crm-reminder-del-btn" onClick={() => handleDeleteReminder(f.id)} aria-label="Delete reminder">
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {showReminderForm ? (
            <div className="crm-reminder-form">
              <div className="crm-reminder-form-row">
                <input
                  type="date"
                  value={reminderDate}
                  onChange={(e) => setReminderDate(e.target.value)}
                  className="crm-reminder-input"
                  aria-label="Reminder date"
                />
                <input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className="crm-reminder-input"
                  aria-label="Reminder time"
                />
              </div>
              <input
                type="text"
                value={reminderNote}
                onChange={(e) => setReminderNote(e.target.value)}
                placeholder="What to follow up about? (optional)"
                className="crm-reminder-note-input"
              />
              <div className="crm-reminder-form-actions">
                <button className="crm-reminder-cancel-btn" onClick={() => setShowReminderForm(false)}>Cancel</button>
                <button className="crm-reminder-save-btn" onClick={handleCreateReminder} disabled={!reminderDate || !reminderTime || savingReminder}>
                  {savingReminder ? <Loader2 size={16} className="crm-spin" /> : <CalendarClock size={16} />}
                  {savingReminder ? 'Setting...' : 'Set Reminder'}
                </button>
              </div>
            </div>
          ) : (
            <button className="crm-reminder-add-btn" onClick={() => setShowReminderForm(true)}>
              <CalendarClock size={18} /> Set Follow-up Reminder
            </button>
          )}
          <p className="crm-reminder-hint">You'll get an email alert at your configured email address when the reminder is due.</p>
        </div>

        {/* Quick Call Actions */}
        <div className="crm-drawer-section">
          <label className="crm-drawer-label">QUICK ACTIONS</label>
          <div className="crm-quick-actions">
            <button type="button" className="crm-quick-btn crm-quick-call" onClick={() => onCall(lead.mobile_number)} style={{ cursor: 'pointer' }}>
              <PhoneCall size={18} /> Call Now
            </button>
            <a href={`https://wa.me/${lead.mobile_number.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="crm-quick-btn crm-quick-wa">
              <MessageCircle size={18} /> WhatsApp
            </a>
          </div>
          <div className="crm-quick-actions" style={{ marginTop: '8px' }}>
            <button className="crm-quick-btn" style={{ background: 'linear-gradient(135deg, #1e40af, #2563eb)', color: 'var(--bg-card)', border: 'none', cursor: 'pointer' }} onClick={() => onSendEmail(lead)}>
              <Send size={18} /> Send Email
            </button>
          </div>
        </div>

        {/* Activity Timeline */}
        <div className="crm-drawer-section">
          <label className="crm-drawer-label"><History size={14} style={{ display: 'inline', marginRight: '4px' }} /> ACTIVITY TIMELINE</label>
          {activitiesLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', color: 'var(--text-dark)', fontSize: '0.82rem' }}>
              <Loader2 size={16} className="crm-spin" /> Loading activities...
            </div>
          ) : activities.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-dark)', fontSize: '0.82rem' }}>
              <History size={28} style={{ marginBottom: '6px', opacity: 0.3 }} />
              <p>No activity recorded yet. Status changes, notes, tags, and follow-ups will appear here.</p>
            </div>
          ) : (
            <div className="crm-activity-timeline">
              {activities.map((act, idx) => {
                const iconMap: Record<string, React.ReactNode> = {
                  status_change: <Shuffle size={14} style={{ color: '#2563eb' }} />,
                  note: <StickyNote size={14} style={{ color: '#f59e0b' }} />,
                  email_sent: <Send size={14} style={{ color: '#6366f1' }} />,
                  telegram_message: <MessageCircle size={14} style={{ color: '#0088cc' }} />,
                  whatsapp_message: <MessageSquare size={14} style={{ color: '#25D366' }} />,
                  follow_up_created: <Bell size={14} style={{ color: '#f59e0b' }} />,
                  follow_up_done: <CheckCircle2 size={14} style={{ color: '#22c55e' }} />,
                  lead_created: <Plus size={14} style={{ color: '#16a34a' }} />,
                  tag_added: <Tag size={14} style={{ color: '#8b5cf6' }} />,
                  tag_removed: <Tag size={14} style={{ color: '#ef4444' }} />,
                  call: <PhoneCall size={14} style={{ color: '#0891b2' }} />,
                  assignment: <Shuffle size={14} style={{ color: '#0f766e' }} />,
                };
                return (
                  <div key={act.id} className="crm-activity-item">
                    {idx < activities.length - 1 && <div className="crm-activity-line" />}
                    <div className="crm-activity-dot">
                      {iconMap[act.activity_type] || <History size={14} style={{ color: 'var(--text-dark)' }} />}
                    </div>
                    <div className="crm-activity-body">
                      <span className="crm-activity-desc">{act.description}</span>
                      <span className="crm-activity-time">
                        {new Date(act.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at{' '}
                        {new Date(act.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Danger Zone */}
        <div className="crm-drawer-section crm-drawer-danger">
          {confirmDelete ? (
            <div className="crm-delete-confirm">
              <div className="crm-delete-warning">
                <AlertTriangle size={18} />
                <span>Delete <strong>{lead.full_name}</strong>? This cannot be undone.</span>
              </div>
              <div className="crm-delete-confirm-actions">
                <button className="crm-delete-cancel" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                  Cancel
                </button>
                <button className="crm-delete-confirm-btn" onClick={handleDelete} disabled={deleting}>
                  {deleting ? <Loader2 size={16} className="crm-spin" /> : <Trash2 size={16} />}
                  {deleting ? 'Deleting...' : 'Yes, Delete Lead'}
                </button>
              </div>
            </div>
          ) : (
            <button className="crm-delete-btn" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={16} /> Delete Lead
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ===================== Email Compose Modal =====================
type EmailAttachment = {
  file: File;
  previewUrl: string | null;
};

const ACCEPTED_EMAIL_FILE_TYPES = 'image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip';
const MAX_EMAIL_FILE_SIZE = 25 * 1024 * 1024;
const MAX_EMAIL_TOTAL_SIZE = 50 * 1024 * 1024;
const MAX_EMAIL_FILES = 10;

function getFileIcon(file: File): React.ReactNode {
  const type = file.type;
  if (type.startsWith('image/')) return <ImageIcon size={18} />;
  if (type.startsWith('video/')) return <VideoIcon size={18} />;
  if (type.startsWith('audio/')) return <Mic size={18} />;
  return <FileIcon size={18} />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 / 1024)).toFixed(1)} MB`;
}

function EmailComposeModal({ lead, session, onClose }: {
  lead: Lead;
  session: Session;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState(`Hi ${lead.full_name.split(' ')[0]},\n\n`);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [smtpReady, setSmtpReady] = useState<boolean | null>(null);
  const [fromName, setFromName] = useState('');
  const [attachments, setAttachments] = useState<EmailAttachment[]>([]);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('smtp_settings')
        .select('from_name, from_email')
        .maybeSingle();
      if (data) {
        setSmtpReady(true);
        setFromName(data.from_name || '');
      } else {
        setSmtpReady(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('email_templates')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (data) setTemplates(data as EmailTemplate[]);
    })();
  }, []);

  const applyTemplate = (tpl: EmailTemplate) => {
    const personalized = tpl.body
      .replace(/\{\{name\}\}/g, lead.full_name.split(' ')[0])
      .replace(/\{\{full_name\}\}/g, lead.full_name)
      .replace(/\{\{email\}\}/g, lead.email || '')
      .replace(/\{\{phone\}\}/g, lead.mobile_number || '')
      .replace(/\{\{state\}\}/g, lead.state || '')
      .replace(/\{\{product\}\}/g, lead.trading_product === 'algo' ? 'Trading Algo' : 'TradingView Premium');
    setSubject(tpl.subject);
    setBody(personalized);
    setSent(false);
    setError('');
    setShowTemplatePicker(false);
  };

  const totalAttachmentSize = attachments.reduce((sum, a) => sum + a.file.size, 0);

  const addFiles = (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    setUploadError('');

    const newAttachments: EmailAttachment[] = [];
    let newTotal = totalAttachmentSize;

    for (const file of files) {
      if (attachments.length + newAttachments.length >= MAX_EMAIL_FILES) {
        setUploadError(`Maximum ${MAX_EMAIL_FILES} files allowed.`);
        break;
      }
      if (file.size > MAX_EMAIL_FILE_SIZE) {
        setUploadError(`"${file.name}" is too large. Max ${MAX_EMAIL_FILE_SIZE / 1024 / 1024}MB per file.`);
        continue;
      }
      if (newTotal + file.size > MAX_EMAIL_TOTAL_SIZE) {
        setUploadError(`Total attachment size cannot exceed ${MAX_EMAIL_TOTAL_SIZE / 1024 / 1024}MB.`);
        break;
      }
      newTotal += file.size;
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
      newAttachments.push({ file, previewUrl });
    }

    if (newAttachments.length > 0) {
      setAttachments((prev) => [...prev, ...newAttachments]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => {
      const next = [...prev];
      const removed = next[index];
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      next.splice(index, 1);
      return next;
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.currentTarget === dragRef.current) setIsDragging(false);
  };

  useEffect(() => {
    return () => {
      attachments.forEach((a) => { if (a.previewUrl) URL.revokeObjectURL(a.previewUrl); });
    };
  }, []);

  const handleSend = async () => {
    if (!lead.email) return;
    setSending(true);
    setError('');

    try {
      const subjectLine = subject || `Regarding ${lead.trading_product === 'algo' ? 'Trading Algo' : 'TradingView Premium'}`;
      const signature = fromName.trim() ? `\n\nBest regards,\n${fromName.trim()}` : '';
      const fullBody = body + signature;

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`;
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setError('Session expired. Please sign in again.');
        setSending(false);
        return;
      }

      let response: Response;

      if (attachments.length > 0) {
        const formData = new FormData();
        formData.append('to', lead.email);
        formData.append('subject', subjectLine);
        formData.append('body', fullBody);
        formData.append('lead_id', lead.id);
        for (const att of attachments) {
          formData.append('attachments', att.file, att.file.name);
        }

        response = await fetch(apiUrl, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
      } else {
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ to: lead.email, subject: subjectLine, body: fullBody, lead_id: lead.id }),
        });
      }

      const result = await response.json();
      if (!response.ok) {
        const errMsg = (result && result.error) ? result.error : `Failed to send (${response.status})`;
        setError(errMsg);
        setSending(false);
        return;
      }

      setSent(true);
      setSending(false);
    } catch {
      setError('Network error. Please try again.');
      setSending(false);
    }
  };

  const canSend = Boolean(lead.email && !sending && !sent);

  return (
    <>
      <div className="crm-drawer-overlay" onClick={onClose} />
      <div className="crm-add-lead-modal" style={{ maxWidth: '640px' }}>
        <div className="crm-add-lead-header">
          <div className="crm-add-lead-title">
            <div className="crm-add-lead-icon" style={{ background: 'linear-gradient(135deg, #1e40af, #2563eb)' }}>
              <Send size={22} />
            </div>
            <div>
              <h2>Compose Email</h2>
              <p>To: {lead.full_name} &lt;{lead.email}&gt;</p>
            </div>
          </div>
          <button className="crm-drawer-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="crm-add-lead-form">
          {smtpReady === false && (
            <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px', padding: '12px 16px', color: '#d97706', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <AlertTriangle size={16} /> SMTP not configured. Go to Settings to set up your company email.
            </div>
          )}

          {smtpReady === true && fromName && (
            <div style={{ background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.2)', borderRadius: '8px', padding: '10px 14px', color: '#16a34a', fontSize: '0.8rem', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Mail size={14} /> Sending from: {fromName}
            </div>
          )}

          {/* Template Selector */}
          {templates.length > 0 && (
            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <button
                type="button"
                onClick={() => setShowTemplatePicker((v) => !v)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-light)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)',
                  transition: 'all 0.2s',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={16} style={{ color: '#2563eb' }} />
                  Choose a template
                </span>
                <ChevronDown size={16} style={{ transform: showTemplatePicker ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
              {showTemplatePicker && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
                  background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '8px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: '240px', overflowY: 'auto',
                }}>
                  {templates.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => applyTemplate(tpl)}
                      style={{
                        width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none',
                        background: 'transparent', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)',
                        display: 'flex', flexDirection: 'column', gap: '2px',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-light)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <span style={{ fontSize: '0.83rem', fontWeight: 600, color: 'var(--text-main)' }}>{tpl.name}</span>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-dark)' }}>{tpl.subject}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="crm-email-field">
            <label>
              <span>Subject</span>
              <input
                type="text"
                value={subject}
                onChange={(e) => { setSubject(e.target.value); setSent(false); setError(''); }}
                placeholder="Email subject"
              />
            </label>
          </div>

          <div className="crm-email-field">
            <label>
              <span>Message</span>
              <textarea
                value={body}
                onChange={(e) => { setBody(e.target.value); setSent(false); setError(''); }}
                rows={8}
                placeholder="Write your message here..."
                style={{ fontFamily: 'inherit', resize: 'vertical' }}
              />
            </label>
          </div>

          {/* Attachment Drop Zone */}
          <div
            ref={dragRef}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${isDragging ? '#2563eb' : 'var(--text-dark)'}`,
              borderRadius: '10px',
              padding: '16px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: isDragging ? 'rgba(37,99,235,0.05)' : 'var(--bg-light)',
              marginBottom: '12px',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_EMAIL_FILE_TYPES}
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <Paperclip size={20} style={{ color: 'var(--text-dark)', marginBottom: '6px' }} />
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600, margin: 0 }}>
              {isDragging ? 'Drop files here' : 'Attach photos, videos, audio, or documents'}
            </p>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-dark)', margin: '4px 0 0 0' }}>
              Click to browse or drag & drop — max 25MB per file, 50MB total
            </p>
          </div>

          {/* Attachment List */}
          {attachments.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
              {attachments.map((att, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    background: 'var(--bg-light)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  {att.previewUrl ? (
                    <img
                      src={att.previewUrl}
                      alt={att.file.name}
                      style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }}
                    />
                  ) : (
                    <div style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--border-subtle)', borderRadius: '6px', flexShrink: 0, color: 'var(--text-muted)' }}>
                      {getFileIcon(att.file)}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {att.file.name}
                    </p>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-dark)', margin: '2px 0 0 0' }}>
                      {formatFileSize(att.file.size)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeAttachment(index); }}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px', display: 'flex', alignItems: 'center' }}
                    aria-label="Remove attachment"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              <p style={{ fontSize: '0.72rem', color: 'var(--text-dark)', margin: 0, textAlign: 'right' }}>
                {attachments.length} file{attachments.length !== 1 ? 's' : ''} — {formatFileSize(totalAttachmentSize)}
              </p>
            </div>
          )}

          {uploadError && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', color: '#dc2626', fontSize: '0.8rem', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={14} /> {uploadError}
            </div>
          )}

          {sent && (
            <div style={{ background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.3)', borderRadius: '8px', padding: '12px 16px', color: '#16a34a', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} /> Email sent successfully to {lead.email}.
            </div>
          )}

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '12px 16px', color: '#dc2626', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          <div className="crm-add-lead-actions">
            <button type="button" className="crm-add-lead-cancel" onClick={onClose} disabled={sending}>
              Close
            </button>
            <button type="button" className="crm-add-lead-submit" onClick={handleSend} disabled={!canSend} style={{ background: 'linear-gradient(135deg, #1e40af, #2563eb)' }}>
              {sending ? <Loader2 size={18} className="crm-spin" /> : <Send size={18} />}
              {sending ? 'Sending...' : `Send Email${attachments.length > 0 ? ` (${attachments.length} attachment${attachments.length !== 1 ? 's' : ''})` : ''}`}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ===================== Settings Modal =====================
function SettingsPage({ session, userRole, permissions, customPermissions, onBack, onSignOut, onInboxVisibilityChange, onOpenRecycleBin, pipelineAutoAssignEnabled, pipelineAutoAssignStages, onPipelineAutoAssignChange, onStageLabelsChange, sidebarSections, onSidebarSectionChange, sectionVisibility, onSectionVisibilityChange }: {
  session: Session;
  userRole: UserRole;
  permissions: PermissionFlags;
  customPermissions: Record<string, PermissionFlags>;
  onBack: () => void;
  onSignOut: () => void;
  onInboxVisibilityChange?: (telegram: boolean, whatsapp: boolean) => void;
  onOpenRecycleBin?: () => void;
  pipelineAutoAssignEnabled?: boolean;
  pipelineAutoAssignStages?: string[];
  onPipelineAutoAssignChange?: (enabled: boolean, stages: string[]) => void;
  onStageLabelsChange?: () => void;
  sidebarSections?: Record<string, boolean>;
  onSidebarSectionChange?: (key: string, visible: boolean) => void;
  sectionVisibility?: Record<string, boolean>;
  onSectionVisibilityChange?: (key: string, visible: boolean) => void;
}) {
  const [activeTab, setActiveTab] = useState<'account' | 'email' | 'scheduled_emails' | 'telegram' | 'whatsapp' | 'twilio' | 'team' | 'team_dashboard' | 'role_management' | 'lead_distribution' | 'pipeline_autoassign' | 'pipeline_stages' | 'followup' | 'meta' | 'assignment' | 'recycle_bin' | 'section_visibility' | 'billing' | 'danger'>('account');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [billingModeEnabled, setBillingModeEnabled] = useState(true);

  // Account state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [area, setArea] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountSaved, setAccountSaved] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
  const [uploadingPic, setUploadingPic] = useState(false);
  const profilePicInputRef = useRef<HTMLInputElement>(null);

  // SMTP state (legacy)
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUsername, setSmtpUsername] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('');
  const [useTls, setUseTls] = useState(true);
  const [showImapPassword, setShowImapPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Multi-SMTP servers state
  type SmtpServer = {
    id: string;
    label: string;
    smtp_host: string;
    smtp_port: number;
    smtp_username: string;
    from_email: string | null;
    from_name: string | null;
    use_tls: boolean;
    priority: number;
    is_active: boolean;
    daily_limit: number | null;
    total_sent: number;
    total_failed: number;
    last_error: string | null;
    last_error_at: string | null;
  };
  const [smtpServersList, setSmtpServersList] = useState<SmtpServer[]>([]);
  const [editingSmtpServerId, setEditingSmtpServerId] = useState<string | null>(null);
  const [smtpServerLabel, setSmtpServerLabel] = useState('');
  const [smtpServerHost, setSmtpServerHost] = useState('');
  const [smtpServerPort, setSmtpServerPort] = useState('587');
  const [smtpServerUsername, setSmtpServerUsername] = useState('');
  const [smtpServerPassword, setSmtpServerPassword] = useState('');
  const [smtpServerFromEmail, setSmtpServerFromEmail] = useState('');
  const [smtpServerFromName, setSmtpServerFromName] = useState('');
  const [smtpServerUseTls, setSmtpServerUseTls] = useState(true);
  const [smtpServerDailyLimit, setSmtpServerDailyLimit] = useState('');
  const [showSmtpServerPassword, setShowSmtpServerPassword] = useState(false);
  const [smtpServerSaving, setSmtpServerSaving] = useState(false);
  const [smtpServerError, setSmtpServerError] = useState('');
  const [smtpServerSuccess, setSmtpServerSuccess] = useState(false);
  const [deletingSmtpServerId, setDeletingSmtpServerId] = useState<string | null>(null);

  // Telegram state
  const [botToken, setBotToken] = useState('');
  const [botUsername, setBotUsername] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [telegramLink, setTelegramLink] = useState('');
  const [whatsappGroupLink, setWhatsappGroupLink] = useState('');

  const [showBotToken, setShowBotToken] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<'idle' | 'setting' | 'set' | 'error'>('idle');
  const [webhookUrl, setWebhookUrl] = useState('');

  // Telegram multi-bot state
  type TgBot = {
    id: string;
    label: string;
    bot_token: string;
    bot_username: string | null;
    welcome_message: string | null;
    webhook_secret: string;
    is_active: boolean;
    created_at: string;
  };
  const [tgBotsList, setTgBotsList] = useState<TgBot[]>([]);
  const [editingTgBotId, setEditingTgBotId] = useState<string | null>(null);
  const [tgBotLabel, setTgBotLabel] = useState('');
  const [tgBotToken, setTgBotToken] = useState('');
  const [tgBotUsername, setTgBotUsername] = useState('');
  const [tgBotWelcomeMsg, setTgBotWelcomeMsg] = useState('');
  const [showTgBotToken, setShowTgBotToken] = useState(false);
  const [tgBotSaving, setTgBotSaving] = useState(false);
  const [tgBotError, setTgBotError] = useState('');
  const [tgBotSuccess, setTgBotSuccess] = useState(false);
  const [deletingTgBotId, setDeletingTgBotId] = useState<string | null>(null);
  const [tgWebhookStatuses, setTgWebhookStatuses] = useState<Record<string, 'idle' | 'setting' | 'set' | 'error'>>({});
  const [tgWebhookCopied, setTgWebhookCopied] = useState<string | null>(null);

  // WhatsApp state (multi-number support)
  const [waNumbersList, setWaNumbersList] = useState<WaNumberConfig[]>([]);
  const [editingWaNumberId, setEditingWaNumberId] = useState<string | null>(null);
  const [waLabel, setWaLabel] = useState('');
  const [waPhoneNumberId, setWaPhoneNumberId] = useState('');
  const [waAccessToken, setWaAccessToken] = useState('');
  const [waVerifyToken, setWaVerifyToken] = useState('');
  const [waWabaId, setWaWabaId] = useState('');
  const [waWelcomeMessage, setWaWelcomeMessage] = useState('');
  const [waConnectedNumber, setWaConnectedNumber] = useState('');
  const [showWaToken, setShowWaToken] = useState(false);
  const [waCoexEnabled, setWaCoexEnabled] = useState(false);
  const [waWebhookCopied, setWaWebhookCopied] = useState(false);
  const [waTokenCopied, setWaTokenCopied] = useState(false);
  const [waMetaAppId, setWaMetaAppId] = useState('');
  const [waProfilePicUrl, setWaProfilePicUrl] = useState<string | null>(null);
  const [waProfilePicUploading, setWaProfilePicUploading] = useState(false);
  const [waProfilePicError, setWaProfilePicError] = useState('');
  const [waProfilePicSuccess, setWaProfilePicSuccess] = useState(false);
  const waProfilePicInputRef = useRef<HTMLInputElement>(null);
  const [waNumSaving, setWaNumSaving] = useState(false);
  const [waNumError, setWaNumError] = useState('');
  const [waNumSuccess, setWaNumSuccess] = useState(false);
  const [deletingWaNumberId, setDeletingWaNumberId] = useState<string | null>(null);
  const [waTestingId, setWaTestingId] = useState<string | null>(null);
  const [waTestResult, setWaTestResult] = useState<Record<string, { valid: boolean; message: string; error_type?: string }>>({});

  const testWaToken = async (settingsId: string) => {
    setWaTestingId(settingsId);
    setWaTestResult((prev) => { const next = { ...prev }; delete next[settingsId]; return next; });
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { setWaTestResult((prev) => ({ ...prev, [settingsId]: { valid: false, message: 'Not authenticated' } })); setWaTestingId(null); return; }
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wa-embedded-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'test_token', wa_settings_id: settingsId }),
      });
      const data = await res.json();
      setWaTestResult((prev) => ({ ...prev, [settingsId]: { valid: data.valid, message: data.message, error_type: data.error_type } }));
    } catch {
      setWaTestResult((prev) => ({ ...prev, [settingsId]: { valid: false, message: 'Failed to test connection' } }));
    }
    setWaTestingId(null);
  };

  // Twilio / virtual calling state
  const [callProvider, setCallProvider] = useState<'twilio' | 'exotel' | 'plivo'>('twilio');
  const [twilioAccountSid, setTwilioAccountSid] = useState('');
  const [twilioAuthToken, setTwilioAuthToken] = useState('');
  const [twilioNumber, setTwilioNumber] = useState('');
  const [agentNumber, setAgentNumber] = useState('');
  const [showTwilioToken, setShowTwilioToken] = useState(false);
  const [showCallingGuide, setShowCallingGuide] = useState(false);
  const [twilioCallLogs, setTwilioCallLogs] = useState<{ id: string; phone_number: string; lead_name: string | null; status: string; duration: number; created_at: string }[]>([]);

  // WhatsApp phone number status state
  type WaPhoneStatus = {
    verified_name: string | null;
    display_phone_number: string | null;
    quality_rating: string | null;
    status: string | null;
    name_status: string | null;
    throughput: { level: string } | null;
  } | null;
  const [waPhoneStatus, setWaPhoneStatus] = useState<WaPhoneStatus>(null);
  const [waStatusLoading, setWaStatusLoading] = useState(false);
  const [waStatusError, setWaStatusError] = useState('');
  const [waDisplayName, setWaDisplayName] = useState('');
  const [waDisplayNameSaving, setWaDisplayNameSaving] = useState(false);
  const [waDisplayNameError, setWaDisplayNameError] = useState('');
  const [waDisplayNameSuccess, setWaDisplayNameSuccess] = useState(false);
  const [waRegCode, setWaRegCode] = useState('');
  const [waRegStep, setWaRegStep] = useState<'idle' | 'code_sent' | 'verifying'>('idle');
  const [waRegLoading, setWaRegLoading] = useState(false);
  const [waRegError, setWaRegError] = useState('');
  const [waRegSuccess, setWaRegSuccess] = useState(false);

  // Webhook verification state
  type WaWebhookStatus = {
    webhook_registered: boolean;
    can_check: boolean;
    subscribed_apps?: Array<{ id: string; name: string }>;
    message?: string;
    error?: string;
  } | null;
  const [waWebhookStatus, setWaWebhookStatus] = useState<WaWebhookStatus>(null);
  const [waWebhookChecking, setWaWebhookChecking] = useState(false);
  const [waWebhookRegistering, setWaWebhookRegistering] = useState(false);
  const [waWebhookError, setWaWebhookError] = useState('');
  const [waWebhookSuccess, setWaWebhookSuccess] = useState(false);

  const checkWaWebhook = async () => {
    if (waNumbersList.length === 0) return;
    setWaWebhookChecking(true);
    setWaWebhookError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { setWaWebhookError('Not authenticated'); setWaWebhookChecking(false); return; }
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wa-embedded-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'get_webhook_status', wa_settings_id: waNumbersList[0].id }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setWaWebhookError(data.error || 'Failed to check webhook status');
      } else {
        setWaWebhookStatus(data);
      }
    } catch {
      setWaWebhookError('Failed to check webhook status');
    }
    setWaWebhookChecking(false);
  };

  const registerWaWebhook = async () => {
    if (waNumbersList.length === 0) return;
    setWaWebhookRegistering(true);
    setWaWebhookError('');
    setWaWebhookSuccess(false);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { setWaWebhookError('Not authenticated'); setWaWebhookRegistering(false); return; }
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wa-embedded-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'register_webhook', wa_settings_id: waNumbersList[0].id }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setWaWebhookError(data.error || 'Failed to register webhook');
      } else {
        setWaWebhookSuccess(true);
        setTimeout(() => setWaWebhookSuccess(false), 4000);
        checkWaWebhook();
      }
    } catch {
      setWaWebhookError('Failed to register webhook');
    }
    setWaWebhookRegistering(false);
  };

  const refreshWaStatus = async () => {
    setWaStatusLoading(true);
    setWaStatusError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { setWaStatusError('Not authenticated'); setWaStatusLoading(false); return; }
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-profile-picture?action=status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setWaStatusError(data.error || 'Failed to fetch status');
      } else {
        setWaPhoneStatus(data);
        if (data.verified_name) setWaDisplayName(data.verified_name);
      }
    } catch {
      setWaStatusError('Failed to fetch status');
    }
    setWaStatusLoading(false);
  };

  const resetWaForm = () => {
    setEditingWaNumberId(null);
    setWaLabel('');
    setWaPhoneNumberId('');
    setWaAccessToken('');
    setWaVerifyToken('');
    setWaWabaId('');
    setWaWelcomeMessage('');
    setWaConnectedNumber('');
    setWaMetaAppId('');
    setWaCoexEnabled(false);
    setWaNumError('');
    setWaNumSuccess(false);
  };

  const startEditWaNumber = (n: WaNumberConfig) => {
    setEditingWaNumberId(n.id);
    setWaLabel(n.label || '');
    setWaPhoneNumberId(n.phone_number_id || '');
    setWaAccessToken(n.access_token || '');
    setWaVerifyToken(n.verify_token || '');
    setWaWabaId(n.waba_id || '');
    setWaWelcomeMessage(n.welcome_message || '');
    setWaConnectedNumber(n.connected_phone_number || '');
    setWaMetaAppId(n.meta_app_id || '');
    setWaCoexEnabled(n.coex_enabled === true);
    setWaNumError('');
    setWaNumSuccess(false);
  };

  const handleSaveWaNumber = async () => {
    setWaNumSaving(true);
    setWaNumError('');
    setWaNumSuccess(false);
    if (!waPhoneNumberId.trim() || !waAccessToken.trim()) {
      setWaNumError('Phone Number ID and Access Token are required.');
      setWaNumSaving(false);
      return;
    }
    const cleanToken = waAccessToken.trim().replace(/^["'`]|["'`]$/g, '');
    if (cleanToken.length < 20 || !/^[A-Za-z0-9]+$/.test(cleanToken)) {
      setWaNumError('The Access Token looks invalid. Meta access tokens are a long string of letters and numbers (usually starting with "EA"). Make sure you copied only the token — no quotes, spaces, or extra text.');
      setWaNumSaving(false);
      return;
    }
    const payload = {
      user_id: session.user.id,
      label: waLabel.trim() || null,
      phone_number_id: waPhoneNumberId.trim(),
      access_token: cleanToken,
      verify_token: waVerifyToken.trim() || 'leadcentre_verify_' + Date.now(),
      waba_id: waWabaId.trim() || null,
      welcome_message: waWelcomeMessage.trim(),
      connected_phone_number: waConnectedNumber.trim() || null,
      meta_app_id: waMetaAppId.trim() || null,
      coex_enabled: waCoexEnabled,
      updated_at: new Date().toISOString(),
    };
    if (editingWaNumberId) {
      const { error: updErr } = await supabase.from('whatsapp_settings').update(payload).eq('id', editingWaNumberId);
      if (updErr) { setWaNumError(updErr.message); setWaNumSaving(false); return; }
    } else {
      const { error: insErr } = await supabase.from('whatsapp_settings').insert(payload);
      if (insErr) { setWaNumError(insErr.message); setWaNumSaving(false); return; }
    }
    const { data: refreshed } = await supabase.from('whatsapp_settings').select('*').order('created_at', { ascending: true });
    if (refreshed) setWaNumbersList(refreshed as WaNumberConfig[]);
    setWaNumSaving(false);
    setWaNumSuccess(true);
    setTimeout(() => setWaNumSuccess(false), 3000);
    resetWaForm();
  };

  const handleDeleteWaNumber = async (id: string) => {
    setDeletingWaNumberId(id);
    const { error: delErr } = await supabase.from('whatsapp_settings').delete().eq('id', id);
    if (delErr) { setWaNumError(delErr.message); setDeletingWaNumberId(null); return; }
    setWaNumbersList((prev) => prev.filter((n) => n.id !== id));
    if (editingWaNumberId === id) resetWaForm();
    setDeletingWaNumberId(null);
  };

  // Multi-SMTP server handlers
  const resetSmtpServerForm = () => {
    setEditingSmtpServerId(null);
    setSmtpServerLabel('');
    setSmtpServerHost('');
    setSmtpServerPort('587');
    setSmtpServerUsername('');
    setSmtpServerPassword('');
    setSmtpServerFromEmail('');
    setSmtpServerFromName('');
    setSmtpServerUseTls(true);
    setSmtpServerDailyLimit('');
    setSmtpServerError('');
    setSmtpServerSuccess(false);
  };

  const startEditSmtpServer = (s: SmtpServer) => {
    setEditingSmtpServerId(s.id);
    setSmtpServerLabel(s.label || '');
    setSmtpServerHost(s.smtp_host || '');
    setSmtpServerPort(String(s.smtp_port || 587));
    setSmtpServerUsername(s.smtp_username || '');
    setSmtpServerPassword('');
    setSmtpServerFromEmail(s.from_email || '');
    setSmtpServerFromName(s.from_name || '');
    setSmtpServerUseTls(s.use_tls !== false);
    setSmtpServerDailyLimit(s.daily_limit ? String(s.daily_limit) : '');
    setSmtpServerError('');
    setSmtpServerSuccess(false);
  };

  const handleSaveSmtpServer = async () => {
    setSmtpServerSaving(true);
    setSmtpServerError('');
    setSmtpServerSuccess(false);
    if (!smtpServerHost.trim() || !smtpServerUsername.trim()) {
      setSmtpServerError('SMTP Host and Username are required.');
      setSmtpServerSaving(false);
      return;
    }
    if (!editingSmtpServerId && !smtpServerPassword.trim()) {
      setSmtpServerError('SMTP Password is required for new servers.');
      setSmtpServerSaving(false);
      return;
    }
    const payload: Record<string, unknown> = {
      user_id: session.user.id,
      label: smtpServerLabel.trim() || 'SMTP Server',
      smtp_host: smtpServerHost.trim(),
      smtp_port: parseInt(smtpServerPort) || 587,
      smtp_username: smtpServerUsername.trim(),
      from_email: smtpServerFromEmail.trim() || null,
      from_name: smtpServerFromName.trim() || null,
      use_tls: smtpServerUseTls,
      daily_limit: smtpServerDailyLimit.trim() ? parseInt(smtpServerDailyLimit) : null,
      updated_at: new Date().toISOString(),
    };
    if (smtpServerPassword.trim()) payload.smtp_password = smtpServerPassword;
    if (editingSmtpServerId) {
      const { error: updErr } = await supabase.from('smtp_servers').update(payload).eq('id', editingSmtpServerId);
      if (updErr) { setSmtpServerError(updErr.message); setSmtpServerSaving(false); return; }
    } else {
      const { error: insErr } = await supabase.from('smtp_servers').insert(payload);
      if (insErr) { setSmtpServerError(insErr.message); setSmtpServerSaving(false); return; }
    }
    const { data: refreshed } = await supabase.from('smtp_servers').select('*').order('priority', { ascending: true }).order('created_at', { ascending: true });
    if (refreshed) setSmtpServersList(refreshed as SmtpServer[]);
    setSmtpServerSaving(false);
    setSmtpServerSuccess(true);
    setTimeout(() => setSmtpServerSuccess(false), 3000);
    resetSmtpServerForm();
  };

  const handleDeleteSmtpServer = async (id: string) => {
    setDeletingSmtpServerId(id);
    const { error: delErr } = await supabase.from('smtp_servers').delete().eq('id', id);
    if (delErr) { setSmtpServerError(delErr.message); setDeletingSmtpServerId(null); return; }
    setSmtpServersList((prev) => prev.filter((s) => s.id !== id));
    if (editingSmtpServerId === id) resetSmtpServerForm();
    setDeletingSmtpServerId(null);
  };

  const handleToggleSmtpServer = async (s: SmtpServer) => {
    const { error } = await supabase.from('smtp_servers').update({ is_active: !s.is_active, updated_at: new Date().toISOString() }).eq('id', s.id);
    if (error) { setSmtpServerError(error.message); return; }
    setSmtpServersList((prev) => prev.map((x) => x.id === s.id ? { ...x, is_active: !x.is_active } : x));
  };

  // WhatsApp message templates state
  type WaTemplate = {
    meta_template_id: string | null;
    name: string;
    language: string;
    category: string;
    status: string;
    components: any[];
    rejection_reason: string | null;
  };
  // Team members state
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'manager' | 'agent'>('agent');
  const [inviting, setInviting] = useState(false);
  const [teamError, setTeamError] = useState('');
  const [teamSuccess, setTeamSuccess] = useState('');

  // Role management state
  const [rolePerms, setRolePerms] = useState<Record<string, PermissionFlags>>({});
  const [rolePermsLoading, setRolePermsLoading] = useState(false);
  const [rolePermsSaving, setRolePermsSaving] = useState(false);
  const [rolePermsSaved, setRolePermsSaved] = useState(false);
  const [rolePermsError, setRolePermsError] = useState('');
  const [selectedRoleForEditing, setSelectedRoleForEditing] = useState<'admin' | 'manager' | 'agent'>('agent');

  // Follow-up settings state
  const [reminderEmails, setReminderEmails] = useState<string[]>(['']);
  const [enableReminders, setEnableReminders] = useState(true);
  const [enableChatNotifications, setEnableChatNotifications] = useState(false);
  const [enableWhatsAppNotifications, setEnableWhatsAppNotifications] = useState(false);
  const [enableTelegramNotifications, setEnableTelegramNotifications] = useState(false);
  const [enableAutoWelcomeEmail, setEnableAutoWelcomeEmail] = useState(false);
  const [autoWelcomeEmailSubject, setAutoWelcomeEmailSubject] = useState('');
  const [autoWelcomeEmailBody, setAutoWelcomeEmailBody] = useState('');
  const [welcomeUrgencyHours, setWelcomeUrgencyHours] = useState(24);
  const [welcomeNextSteps, setWelcomeNextSteps] = useState('');
  const [welcomeBookingLink, setWelcomeBookingLink] = useState('');
  const [welcomeTestimonial, setWelcomeTestimonial] = useState('');
  const [welcomeTestimonialAuthor, setWelcomeTestimonialAuthor] = useState('');
  const [welcomeReplyTracking, setWelcomeReplyTracking] = useState(false);
  const [allFollowups, setAllFollowups] = useState<FollowUp[]>([]);

  // Lead assignment state
  const [autoAssignEnabled, setAutoAssignEnabled] = useState(false);
  const [assignmentStrategy, setAssignmentStrategy] = useState<'round_robin' | 'workload' | 'expertise'>('round_robin');
  const [assignmentMembers, setAssignmentMembers] = useState<TeamMember[]>([]);

  // Pipeline auto-assign state (owned here, synced to parent via callback)
  const [paEnabled, setPaEnabled] = useState<boolean>(pipelineAutoAssignEnabled ?? true);
  const [paStages, setPaStages] = useState<string[]>(pipelineAutoAssignStages ?? ['called_no_response','called_responded','interested','not_interested','converted']);
  const [paSaving, setPaSaving] = useState(false);
  const [paSaved, setPaSaved] = useState(false);
  const [paError, setPaError] = useState('');

  // Pipeline stage labels state
  const [psLabels, setPsLabels] = useState<Record<string, string>>({});
  const [psSaving, setPsSaving] = useState(false);
  const [psSaved, setPsSaved] = useState(false);
  const [psError, setPsError] = useState('');
  const PS_DEFAULT_STAGES: { key: string; defaultLabel: string; color: string }[] = [
    { key: 'new', defaultLabel: 'New', color: '#3B82F6' },
    { key: 'called_no_response', defaultLabel: 'Called - No Response', color: '#F59E0B' },
    { key: 'called_responded', defaultLabel: 'Called - Responded', color: '#06B6D4' },
    { key: 'interested', defaultLabel: 'Interested', color: '#8B5CF6' },
    { key: 'not_interested', defaultLabel: 'Not Interested', color: '#EF4444' },
    { key: 'converted', defaultLabel: 'Converted', color: '#16A34A' },
  ];

  useEffect(() => {
    if (activeTab !== 'pipeline_stages') return;
    (async () => {
      const { data } = await supabase.from('pipeline_stage_labels').select('stage_key, label');
      if (data) {
        const map: Record<string, string> = {};
        for (const row of data as { stage_key: string; label: string }[]) {
          map[row.stage_key] = row.label;
        }
        setPsLabels(map);
      }
    })();
  }, [activeTab]);

  // Load pipeline auto-assign settings when tab is opened
  useEffect(() => {
    if (activeTab !== 'pipeline_autoassign') return;
    (async () => {
      const { data } = await supabase
        .from('pipeline_autoassign_settings')
        .select('enabled, assign_on_stages')
        .maybeSingle();
      if (data) {
        const s = data as { enabled: boolean; assign_on_stages: string[] };
        setPaEnabled(s.enabled);
        setPaStages(s.assign_on_stages || ['called_no_response','called_responded','interested','not_interested','converted']);
      }
    })();
  }, [activeTab]);

  // Form Builder state


  // Appearance state
  const [showTelegramInbox, setShowTelegramInbox] = useState(true);
  const [showWhatsAppInbox, setShowWhatsAppInbox] = useState(true);

  const [setupCost, setSetupCost] = useState(10);

  // Section visibility (per-page show/hide) state
  const [localSectionVis, setLocalSectionVis] = useState<Record<string, boolean>>({
    leads: true, brokers: true, inbox: true, broadcasts: true,
    analytics: true, lead_tracker: true, templates: true, followups: true,
    automations: true, pipeline: true,
  });
  const [sectionVisSaving, setSectionVisSaving] = useState(false);
  const [sectionVisSaved, setSectionVisSaved] = useState(false);

  useEffect(() => {
    if (activeTab !== 'section_visibility') return;
    if (sectionVisibility) setLocalSectionVis(sectionVisibility);
  }, [activeTab, sectionVisibility]);

  // Landing page appearance state
  const [landingPrimary, setLandingPrimary] = useState('#EAB308');
  const [landingStyle, setLandingStyle] = useState<'vibrant' | 'muted' | 'monochrome'>('vibrant');
  const [landingEnabled, setLandingEnabled] = useState(false);
  const [landingPalette, setLandingPalette] = useState<LandingPalette>(DEFAULT_PALETTE);
  const [landingSaving, setLandingSaving] = useState(false);
  const [landingSaved, setLandingSaved] = useState(false);
  const [landingMetaPixelId, setLandingMetaPixelId] = useState('');

  // Meta Conversion API state
  const [metaPixelId, setMetaPixelId] = useState('');
  const [metaAccessToken, setMetaAccessToken] = useState('');
  const [metaApiVersion, setMetaApiVersion] = useState('v18.0');
  const [metaEnabled, setMetaEnabled] = useState(true);
  const [metaCurrency, setMetaCurrency] = useState('USD');
  const [metaDefaultValue, setMetaDefaultValue] = useState('');
  const [metaLeadEventSource, setMetaLeadEventSource] = useState('SahilExchange CRM');
  const [showMetaToken, setShowMetaToken] = useState(false);
  const [metaConversionLog, setMetaConversionLog] = useState<{ id: string; event_name: string; success: boolean; error_message: string | null; created_at: string }[]>([]);
  const [eventMapping, setEventMapping] = useState<Record<LeadStatus, string>>({ ...DEFAULT_STAGE_EVENTS });

  useEffect(() => {
    if (!session?.user) return;
    setLoading(true);
    (async () => {
     try {
      const results = await Promise.allSettled([
        supabase.from('smtp_settings').select('*').maybeSingle(),
        supabase.from('telegram_settings').select('*').maybeSingle(),
        supabase.from('telegram_bots').select('*').order('created_at', { ascending: true }),
        supabase.from('whatsapp_settings').select('*').order('created_at', { ascending: true }).limit(1).maybeSingle(),
        supabase.from('team_members').select('*').order('created_at', { ascending: true }),
        supabase.from('follow_up_settings').select('*').maybeSingle(),
        supabase.from('lead_followups').select('*').order('reminder_at', { ascending: true }),
        supabase.from('meta_conversion_settings').select('*').maybeSingle(),
        supabase.from('meta_conversion_log').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('lead_assignment_settings').select('*').maybeSingle(),
        supabase.from('role_permissions').select('*'),
        supabase.from('appearance_settings').select('*').maybeSingle(),
        supabase.from('twilio_settings').select('*').maybeSingle(),
        supabase.from('twilio_call_logs').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('landing_page_appearance').select('*').maybeSingle(),
        supabase.from('smtp_servers').select('*').order('priority', { ascending: true }),
      ]);
      const R = (idx: number) => {
        const r = results[idx];
        return r.status === 'fulfilled' ? r.value : { data: null, error: null as unknown };
      };
      const smtpRes = R(0);
      const tgRes = R(1);
      const tgBotsRes = R(2);
      const waRes = R(3);
      const teamRes = R(4);
      const fuRes = R(5);
      const fuRemindersRes = R(6);
      const metaRes = R(7);
      const metaLogRes = R(8);
      const assignRes = R(9);
      const rolePermRes = R(10);
      const appearanceRes = R(11);
      const twilioRes = R(12);
      const twilioLogRes = R(13);
      const landingAppearanceRes = R(14);
      const smtpServersRes = R(15);

      if (smtpServersRes.data) {
        setSmtpServersList(smtpServersRes.data as SmtpServer[]);
      }

      if (twilioRes.data) {
        setCallProvider((twilioRes.data.provider as 'twilio' | 'exotel' | 'plivo') || 'twilio');
        setTwilioAccountSid(twilioRes.data.account_sid || '');
        setTwilioAuthToken(twilioRes.data.auth_token || '');
        setTwilioNumber(twilioRes.data.twilio_number || '');
        setAgentNumber(twilioRes.data.agent_number || '');
      }

      if (twilioLogRes.data) {
        setTwilioCallLogs(twilioLogRes.data as { id: string; phone_number: string; lead_name: string | null; status: string; duration: number; created_at: string }[]);
      }

      if (appearanceRes.data) {
        const a = appearanceRes.data as { show_telegram_inbox: boolean; show_whatsapp_inbox: boolean; setup_cost: number | null };
        setSetupCost(a.setup_cost ?? 10);
        setShowTelegramInbox(a.show_telegram_inbox !== false);
        setShowWhatsAppInbox(a.show_whatsapp_inbox !== false);
        const sv = appearanceRes.data as Record<string, unknown>;
        setLocalSectionVis({
          leads: sv.show_leads !== false,
          brokers: sv.show_brokers !== false,
          inbox: sv.show_inbox !== false,
          broadcasts: sv.show_broadcasts !== false,
          analytics: sv.show_analytics !== false,
          lead_tracker: sv.show_lead_tracker !== false,
          templates: sv.show_templates !== false,
          followups: sv.show_followups !== false,
          automations: sv.show_automations !== false,
          pipeline: sv.show_pipeline !== false,
        });
      }

      if (landingAppearanceRes.data) {
        const la = landingAppearanceRes.data as { primary_color: string; palette_style: string; enabled: boolean; primary_light: string | null; primary_dark: string | null; accent: string | null; accent_dark: string | null; background: string | null; surface: string | null; surface_tint: string | null; text: string | null; text_muted: string | null; border: string | null; button_bg: string | null; button_text: string | null; button_hover: string | null; badge_bg: string | null; badge_text: string | null; footer_bg: string | null; footer_text: string | null };
        setLandingPrimary(la.primary_color || '#EAB308');
        setLandingStyle((la.palette_style as PaletteStyle) || 'vibrant');
        setLandingEnabled(la.enabled !== false);
        setLandingMetaPixelId((landingAppearanceRes.data as Record<string, unknown>).meta_pixel_id as string || '');
        setLandingPalette({
          primary: la.primary_color || DEFAULT_PALETTE.primary,
          primaryLight: la.primary_light || DEFAULT_PALETTE.primaryLight,
          primaryDark: la.primary_dark || DEFAULT_PALETTE.primaryDark,
          accent: la.accent || DEFAULT_PALETTE.accent,
          accentDark: la.accent_dark || DEFAULT_PALETTE.accentDark,
          background: la.background || DEFAULT_PALETTE.background,
          surface: la.surface || DEFAULT_PALETTE.surface,
          surfaceTint: la.surface_tint || DEFAULT_PALETTE.surfaceTint,
          text: la.text || DEFAULT_PALETTE.text,
          textMuted: la.text_muted || DEFAULT_PALETTE.textMuted,
          border: la.border || DEFAULT_PALETTE.border,
          buttonBg: la.button_bg || DEFAULT_PALETTE.buttonBg,
          buttonText: la.button_text || DEFAULT_PALETTE.buttonText,
          buttonHover: la.button_hover || DEFAULT_PALETTE.buttonHover,
          badgeBg: la.badge_bg || DEFAULT_PALETTE.badgeBg,
          badgeText: la.badge_text || DEFAULT_PALETTE.badgeText,
          footerBg: la.footer_bg || DEFAULT_PALETTE.footerBg,
          footerText: la.footer_text || DEFAULT_PALETTE.footerText,
        });
      }

      if (assignRes.data) {
        setAutoAssignEnabled(assignRes.data.enabled !== false);
        const s = (assignRes.data as { strategy?: string }).strategy;
        if (s === 'workload' || s === 'expertise') setAssignmentStrategy(s);
      }

      if (metaRes.data) {
        setMetaPixelId(metaRes.data.pixel_id || '');
        setMetaAccessToken(metaRes.data.access_token || '');
        setMetaApiVersion(metaRes.data.api_version || 'v18.0');
        setMetaEnabled(metaRes.data.is_enabled !== false);
        setMetaCurrency((metaRes.data as Record<string, unknown>).currency as string || 'USD');
        setMetaDefaultValue((metaRes.data as Record<string, unknown>).default_purchase_value != null ? String((metaRes.data as Record<string, unknown>).default_purchase_value) : '');
        setMetaLeadEventSource((metaRes.data as Record<string, unknown>).lead_event_source as string || 'SahilExchange CRM');
        const m = metaRes.data as Record<string, unknown>;
        setEventMapping({
          new: (m.event_new as string) || DEFAULT_STAGE_EVENTS.new,
          called_no_response: (m.event_called_no_response as string) || DEFAULT_STAGE_EVENTS.called_no_response,
          called_responded: (m.event_called_responded as string) || DEFAULT_STAGE_EVENTS.called_responded,
          interested: (m.event_interested as string) || DEFAULT_STAGE_EVENTS.interested,
          not_interested: (m.event_not_interested as string) || DEFAULT_STAGE_EVENTS.not_interested,
          converted: (m.event_converted as string) || DEFAULT_STAGE_EVENTS.converted,
        });
      }

      if (metaLogRes.data) {
        setMetaConversionLog(metaLogRes.data as { id: string; event_name: string; success: boolean; error_message: string | null; created_at: string }[]);
      }

      if (tgRes.data) {
        setBotToken(tgRes.data.bot_token || '');
        setBotUsername(tgRes.data.bot_username || '');
        setWelcomeMessage(tgRes.data.welcome_message || '');
        setTelegramLink(tgRes.data.telegram_link || '');
        setWhatsappGroupLink(tgRes.data.whatsapp_group_link || '');

      }

      if (tgBotsRes.data) {
        setTgBotsList(tgBotsRes.data as TgBot[]);
      }

      if (waRes.data) {
        setWaPhoneNumberId(waRes.data.phone_number_id || '');
        setWaAccessToken(waRes.data.access_token || '');
        setWaVerifyToken(waRes.data.verify_token || `leadcentre_verify_${Date.now()}`);
        setWaWabaId(waRes.data.waba_id || '');
        setWaWelcomeMessage(waRes.data.welcome_message || '');
        setWaConnectedNumber(waRes.data.connected_phone_number || '');
        setWaMetaAppId(waRes.data.meta_app_id || '');
      } else {
        // First-time setup: pre-generate a verify token so the user can copy
        // it into Meta's webhook config and verify before saving.
        setWaVerifyToken(`leadcentre_verify_${Date.now()}`);
      }

      // Fetch all WhatsApp numbers for multi-number UI
      const { data: allWaNumbers } = await supabase.from('whatsapp_settings').select('*').order('created_at', { ascending: true });
      if (allWaNumbers) setWaNumbersList(allWaNumbers as WaNumberConfig[]);

      // Fetch current WhatsApp profile picture and phone number status
      if (waRes.data?.phone_number_id && waRes.data?.access_token) {
        try {
          const token = (await supabase.auth.getSession()).session?.access_token;
          if (token) {
            const [picRes, statusRes] = await Promise.all([
              fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-profile-picture?action=get`, {
                headers: { Authorization: `Bearer ${token}` },
              }),
              fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-profile-picture?action=status`, {
                headers: { Authorization: `Bearer ${token}` },
              }),
            ]);
            if (picRes.ok) {
              const picData = await picRes.json();
              setWaProfilePicUrl(picData.profile_picture_url || null);
            }
            if (statusRes.ok) {
              const statusData = await statusRes.json();
              setWaPhoneStatus(statusData);
              if (statusData.verified_name) setWaDisplayName(statusData.verified_name);
            } else if (!statusRes.ok) {
              const statusData = await statusRes.json();
              setWaStatusError(statusData.error || 'Failed to fetch status');
            }
          }
        } catch {
          // Non-fatal — profile picture and status are optional
        }
      }

      if (teamRes.data) {
        setTeamMembers(teamRes.data as TeamMember[]);
        setAssignmentMembers((teamRes.data as TeamMember[]).filter((m) => m.status === 'active'));
      }

      if (rolePermRes.data) {
        const rpMap: Record<string, PermissionFlags> = {};
        for (const row of rolePermRes.data as RolePermissionRow[]) {
          rpMap[row.role] = dbRowToPermissions(row);
        }
        setRolePerms(rpMap);
      }

      if (fuRes.data) {
        const emails = fuRes.data.reminder_emails && fuRes.data.reminder_emails.length > 0
          ? fuRes.data.reminder_emails
          : (fuRes.data.reminder_email ? [fuRes.data.reminder_email] : (accountEmail ? [accountEmail] : ['']));
        setReminderEmails(emails);
        setEnableReminders(fuRes.data.enable_reminders !== false);
        setEnableChatNotifications(fuRes.data.enable_chat_notifications === true);
        setEnableWhatsAppNotifications(fuRes.data.enable_whatsapp_notifications === true);
        setEnableTelegramNotifications(fuRes.data.enable_telegram_notifications === true);
        setEnableAutoWelcomeEmail(fuRes.data.enable_auto_welcome_email === true);
        setAutoWelcomeEmailSubject(fuRes.data.auto_welcome_email_subject || '');
        setAutoWelcomeEmailBody(fuRes.data.auto_welcome_email_body || '');
        setWelcomeUrgencyHours(fuRes.data.welcome_urgency_hours ?? 24);
        setWelcomeNextSteps(fuRes.data.welcome_next_steps || '');
        setWelcomeBookingLink(fuRes.data.welcome_booking_link || '');
        setWelcomeTestimonial(fuRes.data.welcome_testimonial || '');
        setWelcomeTestimonialAuthor(fuRes.data.welcome_testimonial_author || '');
        setWelcomeReplyTracking(fuRes.data.welcome_reply_tracking === true);
      } else {
        setReminderEmails(accountEmail ? [accountEmail] : ['']);
      }

      if (fuRemindersRes.data) {
        setAllFollowups(fuRemindersRes.data as FollowUp[]);
      }

      // Load account info from user_metadata
      const meta = session.user.user_metadata || {};
      setFirstName(meta.first_name || '');
      setLastName(meta.last_name || '');
      setPhoneNumber(meta.phone_number || '');
      setAddressLine(meta.address_line || '');
      setArea(meta.area || '');
      setPinCode(meta.pin_code || '');
      setAccountEmail(session.user.email || '');
      setProfilePicUrl(meta.profile_pic_url || null);

      const { data: billingToggle } = await supabase
        .from('feature_toggles')
        .select('is_enabled')
        .eq('key', 'platform_billing_mode')
        .maybeSingle();
      setBillingModeEnabled(billingToggle ? billingToggle.is_enabled : true);

      setLoading(false);
     } catch (err) {
       setError(err instanceof Error ? err.message : 'Failed to load settings. Please reload the page.');
       setLoading(false);
     }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);

    if (activeTab === 'email') {
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      return;
    } else if (activeTab === 'account') {
      setAccountSaving(true);
      setAccountError('');
      setAccountSaved(false);
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone_number: phoneNumber.trim(),
          address_line: addressLine.trim(),
          area: area.trim(),
          pin_code: pinCode.trim(),
          profile_pic_url: profilePicUrl,
        },
      });
      if (updateError) {
        setAccountError(updateError.message);
        setAccountSaving(false);
        return;
      }
      setAccountSaved(true);
      setAccountSaving(false);
      setTimeout(() => setAccountSaved(false), 3000);
      setSaving(false);
      return;
    } else if (activeTab === 'telegram') {
      const payload = {
        user_id: session.user.id,
        telegram_link: telegramLink.trim(),
        whatsapp_group_link: whatsappGroupLink.trim(),

        updated_at: new Date().toISOString(),
      };

      const { data: existing } = await supabase.from('telegram_settings').select('id').maybeSingle();
      const result = existing
        ? await supabase.from('telegram_settings').update(payload).eq('id', existing.id)
        : await supabase.from('telegram_settings').insert({ ...payload, bot_token: botToken.trim(), bot_username: botUsername.trim().replace(/^@/, ''), welcome_message: welcomeMessage.trim() });

      if (result.error) { setError(result.error.message); setSaving(false); return; }
    } else if (activeTab === 'whatsapp') {
      // Multi-number: handled via dedicated add/update/delete buttons
      // This save is for the profile pic / display name / templates sub-sections
      // The actual number CRUD is done through handleSaveWaNumber / handleDeleteWaNumber
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      return;
    } else if (activeTab === 'twilio') {
      const payload = {
        user_id: session.user.id,
        provider: callProvider,
        account_sid: twilioAccountSid.trim(),
        auth_token: twilioAuthToken.trim(),
        twilio_number: twilioNumber.trim(),
        agent_number: agentNumber.trim(),
        updated_at: new Date().toISOString(),
      };

      const { data: existing } = await supabase.from('twilio_settings').select('id').maybeSingle();
      const result = existing
        ? await supabase.from('twilio_settings').update(payload).eq('id', existing.id)
        : await supabase.from('twilio_settings').insert(payload);

      if (result.error) { setError(result.error.message); setSaving(false); return; }
    } else if (activeTab === 'followup') {
      const payload = {
        user_id: session.user.id,
        reminder_email: reminderEmails.filter((e) => e.trim())[0] || null,
        reminder_emails: reminderEmails.filter((e) => e.trim()),
        enable_reminders: enableReminders,
        enable_chat_notifications: enableChatNotifications,
        enable_whatsapp_notifications: enableWhatsAppNotifications,
        enable_telegram_notifications: enableTelegramNotifications,
        enable_auto_welcome_email: enableAutoWelcomeEmail,
        auto_welcome_email_subject: autoWelcomeEmailSubject.trim() || null,
        auto_welcome_email_body: autoWelcomeEmailBody.trim() || null,
        welcome_urgency_hours: welcomeUrgencyHours || null,
        welcome_next_steps: welcomeNextSteps.trim() || null,
        welcome_booking_link: welcomeBookingLink.trim() || null,
        welcome_testimonial: welcomeTestimonial.trim() || null,
        welcome_testimonial_author: welcomeTestimonialAuthor.trim() || null,
        welcome_reply_tracking: welcomeReplyTracking,
        updated_at: new Date().toISOString(),
      };

      const { data: existing } = await supabase.from('follow_up_settings').select('id').maybeSingle();
      const result = existing
        ? await supabase.from('follow_up_settings').update(payload).eq('id', existing.id)
        : await supabase.from('follow_up_settings').insert(payload);

      if (result.error) { setError(result.error.message); setSaving(false); return; }
    } else if (activeTab === 'meta') {
      const payload = {
        user_id: session.user.id,
        pixel_id: metaPixelId.trim(),
        access_token: metaAccessToken.trim(),
        api_version: metaApiVersion.trim() || 'v18.0',
        is_enabled: metaEnabled,
        currency: metaCurrency.trim() || 'USD',
        default_purchase_value: metaDefaultValue.trim() ? parseFloat(metaDefaultValue) : null,
        lead_event_source: metaLeadEventSource.trim() || 'SahilExchange CRM',
        event_new: eventMapping.new,
        event_called_no_response: eventMapping.called_no_response,
        event_called_responded: eventMapping.called_responded,
        event_interested: eventMapping.interested,
        event_not_interested: eventMapping.not_interested,
        event_converted: eventMapping.converted,
        updated_at: new Date().toISOString(),
      };

      const { data: existing } = await supabase.from('meta_conversion_settings').select('id').maybeSingle();
      const result = existing
        ? await supabase.from('meta_conversion_settings').update(payload).eq('id', existing.id)
        : await supabase.from('meta_conversion_settings').insert(payload);

      if (result.error) { setError(result.error.message); setSaving(false); return; }
    } else if (activeTab === 'assignment') {
      const payload = {
        user_id: session.user.id,
        enabled: autoAssignEnabled,
        strategy: assignmentStrategy,
        updated_at: new Date().toISOString(),
      };

      const { data: existing } = await supabase.from('lead_assignment_settings').select('id').maybeSingle();
      const result = existing
        ? await supabase.from('lead_assignment_settings').update(payload).eq('id', existing.id)
        : await supabase.from('lead_assignment_settings').insert(payload);

      if (result.error) { setError(result.error.message); setSaving(false); return; }
    } else if (activeTab === 'role_management') {
      setRolePermsSaving(true);
      setRolePermsError('');
      setRolePermsSaved(false);

      const roles: ('admin' | 'manager' | 'agent')[] = ['admin', 'manager', 'agent'];
      for (const role of roles) {
        const perms = rolePerms[role] || ROLE_PERMISSIONS[role];
        const payload = {
          owner_id: session.user.id,
          role,
          leads: perms.leads,
          inbox: perms.inbox,
          export: perms.export,
          delete_leads: perms.deleteLeads,
          add_leads: perms.addLeads,
          bulk_upload: perms.bulkUpload,
          dialer: perms.dialer,
          settings: perms.settings,
          team_management: perms.teamManagement,
          analytics: perms.analytics,
          broadcasts: perms.broadcasts,
          follow_ups: perms.followUps,
          automations: perms.automations,
          updated_at: new Date().toISOString(),
        };

        const { error: upsertError } = await supabase.from('role_permissions').upsert(payload, { onConflict: 'owner_id,role' });

        if (upsertError) {
          setRolePermsError(upsertError.message);
          setRolePermsSaving(false);
          return;
        }
      }

      setRolePermsSaved(true);
      setRolePermsSaving(false);
      setTimeout(() => setRolePermsSaved(false), 3000);
      setSaving(false);
      return;
    }

    setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleSaveSectionVisibility = async () => {
    setSectionVisSaving(true);
    setError('');
    setSectionVisSaved(false);
    try {
      const payload = {
        show_leads: localSectionVis.leads,
        show_brokers: localSectionVis.brokers,
        show_inbox: localSectionVis.inbox,
        show_broadcasts: localSectionVis.broadcasts,
        show_analytics: localSectionVis.analytics,
        show_lead_tracker: localSectionVis.lead_tracker,
        show_templates: localSectionVis.templates,
        show_followups: localSectionVis.followups,
        show_automations: localSectionVis.automations,
        show_pipeline: localSectionVis.pipeline,
        updated_at: new Date().toISOString(),
      };
      const { data: existing } = await supabase.from('appearance_settings').select('id').maybeSingle();
      const result = existing
        ? await supabase.from('appearance_settings').update(payload).eq('id', existing.id)
        : await supabase.from('appearance_settings').insert({ ...payload, user_id: session.user.id });
      if (result.error) { setError(result.error.message); setSectionVisSaving(false); return; }
      Object.entries(localSectionVis).forEach(([key, val]) => onSectionVisibilityChange?.(key, val));
      setSectionVisSaved(true);
      setTimeout(() => setSectionVisSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save section visibility');
    }
    setSectionVisSaving(false);
  };

  const handleSaveLandingAppearance = async () => {
    setLandingSaving(true);
    setError('');
    setLandingSaved(false);

    const palette = generatePalette(landingPrimary, landingStyle);
    setLandingPalette(palette);

    const payload = {
      user_id: session.user.id,
      primary_color: landingPrimary,
      palette_style: landingStyle,
      enabled: landingEnabled,
      primary_light: palette.primaryLight,
      primary_dark: palette.primaryDark,
      accent: palette.accent,
      accent_dark: palette.accentDark,
      background: palette.background,
      surface: palette.surface,
      surface_tint: palette.surfaceTint,
      text: palette.text,
      text_muted: palette.textMuted,
      border: palette.border,
      button_bg: palette.buttonBg,
      button_text: palette.buttonText,
      button_hover: palette.buttonHover,
      badge_bg: palette.badgeBg,
      badge_text: palette.badgeText,
      footer_bg: palette.footerBg,
      footer_text: palette.footerText,
      meta_pixel_id: landingMetaPixelId.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase.from('landing_page_appearance').select('id').maybeSingle();
    const result = existing
      ? await supabase.from('landing_page_appearance').update(payload).eq('id', existing.id)
      : await supabase.from('landing_page_appearance').insert(payload);

    if (result.error) {
      setError(result.error.message);
      setLandingSaving(false);
      return;
    }

    setLandingSaved(true);
    setLandingSaving(false);
    setTimeout(() => setLandingSaved(false), 3000);
  };

  const handleSetupWebhook = async (botId?: string, botToken?: string, webhookSecret?: string) => {
    const token = botToken?.trim();
    if (!token) return;

    if (botId) {
      setTgWebhookStatuses((prev) => ({ ...prev, [botId]: 'setting' }));
    } else {
      setWebhookStatus('setting');
    }
    setError('');

    try {
      const secretPath = webhookSecret ? `/${webhookSecret}` : '';
      const hookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-webhook${secretPath}`;
      const tgApiUrl = `https://api.telegram.org/bot${token}/setWebhook`;
      const tgResponse = await fetch(tgApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: hookUrl }),
      });
      const tgData = await tgResponse.json();

      if (tgData.ok) {
        if (botId) {
          setTgWebhookStatuses((prev) => ({ ...prev, [botId]: 'set' }));
        } else {
          setWebhookStatus('set');
          setWebhookUrl(hookUrl);
        }
      } else {
        if (botId) {
          setTgWebhookStatuses((prev) => ({ ...prev, [botId]: 'error' }));
        } else {
          setWebhookStatus('error');
        }
        setError(tgData.description || 'Failed to set webhook');
      }
    } catch {
      if (botId) {
        setTgWebhookStatuses((prev) => ({ ...prev, [botId]: 'error' }));
      } else {
        setWebhookStatus('error');
      }
      setError('Network error while setting up webhook');
    }
  };

  const resetTgBotForm = () => {
    setEditingTgBotId(null);
    setTgBotLabel('');
    setTgBotToken('');
    setTgBotUsername('');
    setTgBotWelcomeMsg('');
    setTgBotError('');
    setTgBotSuccess(false);
  };

  const startEditTgBot = (bot: TgBot) => {
    setEditingTgBotId(bot.id);
    setTgBotLabel(bot.label || '');
    setTgBotToken(bot.bot_token || '');
    setTgBotUsername(bot.bot_username || '');
    setTgBotWelcomeMsg(bot.welcome_message || '');
    setTgBotError('');
    setTgBotSuccess(false);
  };

  const handleSaveTgBot = async () => {
    if (!tgBotToken.trim()) {
      setTgBotError('Bot token is required.');
      return;
    }
    setTgBotSaving(true);
    setTgBotError('');
    setTgBotSuccess(false);

    const payload = {
      user_id: session.user.id,
      label: tgBotLabel.trim() || 'Telegram Bot',
      bot_token: tgBotToken.trim(),
      bot_username: tgBotUsername.trim().replace(/^@/, '') || null,
      welcome_message: tgBotWelcomeMsg.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (editingTgBotId) {
      const { error: updErr } = await supabase.from('telegram_bots').update(payload).eq('id', editingTgBotId);
      if (updErr) { setTgBotError(updErr.message); setTgBotSaving(false); return; }
    } else {
      const { error: insErr } = await supabase.from('telegram_bots').insert(payload);
      if (insErr) { setTgBotError(insErr.message); setTgBotSaving(false); return; }
    }

    const { data: refreshed } = await supabase.from('telegram_bots').select('*').order('created_at', { ascending: true });
    if (refreshed) setTgBotsList(refreshed as TgBot[]);

    setTgBotSaving(false);
    setTgBotSuccess(true);
    setTimeout(() => setTgBotSuccess(false), 3000);
    resetTgBotForm();
  };

  const handleDeleteTgBot = async (id: string) => {
    setDeletingTgBotId(id);
    const { error: delErr } = await supabase.from('telegram_bots').delete().eq('id', id);
    if (delErr) { setTgBotError(delErr.message); setDeletingTgBotId(null); return; }
    setTgBotsList((prev) => prev.filter((b) => b.id !== id));
    if (editingTgBotId === id) resetTgBotForm();
    setDeletingTgBotId(null);
  };

  const handleToggleTgBot = async (bot: TgBot) => {
    const newVal = !bot.is_active;
    const { error } = await supabase.from('telegram_bots').update({ is_active: newVal, updated_at: new Date().toISOString() }).eq('id', bot.id);
    if (!error) {
      setTgBotsList((prev) => prev.map((b) => (b.id === bot.id ? { ...b, is_active: newVal } : b)));
    }
  };

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setTeamError('');
    setTeamSuccess('');

    const email = inviteEmail.trim().toLowerCase();
    if (email === (session.user.email || '').toLowerCase()) {
      setTeamError('You cannot invite yourself');
      setInviting(false);
      return;
    }

    const existing = teamMembers.find((m) => m.email.toLowerCase() === email);
    if (existing) {
      setTeamError('This email has already been invited');
      setInviting(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from('team_members')
      .insert({
        owner_id: session.user.id,
        email,
        role: inviteRole,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      setTeamError(insertError.message);
    } else if (data) {
      setTeamMembers((prev) => [data as TeamMember, ...prev]);
      setInviteEmail('');
      setTeamSuccess(`Invitation sent to ${email}. They can sign up with this email to join your team.`);

      // Send invitation email with Login button
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (token) {
          const appUrl = window.location.origin;
          const inviteRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-team-invite`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              inviteeEmail: email,
              inviteeRole: inviteRole,
              appUrl,
            }),
          });
          if (!inviteRes.ok) {
            const errBody = await inviteRes.json().catch(() => ({}));
            setTeamError(errBody.error || `Failed to send invite email (${inviteRes.status})`);
            setTeamSuccess('');
          }
        }
      } catch (inviteErr) {
        setTeamError(inviteErr instanceof Error ? inviteErr.message : 'Failed to send invite email');
        setTeamSuccess('');
      }

      setTimeout(() => setTeamSuccess(''), 5000);
    }
    setInviting(false);
  };

  const handleResendInvite = async (member: TeamMember) => {
    setTeamError('');
    setTeamSuccess('');
    setInviting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setTeamError('Not authenticated');
        setInviting(false);
        return;
      }
      const appUrl = window.location.origin;
      const inviteRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-team-invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          inviteeEmail: member.email,
          inviteeRole: member.role,
          appUrl,
        }),
      });
      if (!inviteRes.ok) {
        const errBody = await inviteRes.json().catch(() => ({}));
        setTeamError(errBody.error || `Failed to send invite email (${inviteRes.status})`);
      } else {
        setTeamSuccess(`Invitation email resent to ${member.email}`);
        setTimeout(() => setTeamSuccess(''), 5000);
      }
    } catch (inviteErr) {
      setTeamError(inviteErr instanceof Error ? inviteErr.message : 'Failed to resend invite email');
    }
    setInviting(false);
  };

  const handleUpdateMemberRole = async (id: string, newRole: 'admin' | 'manager' | 'agent') => {
    const { error: updateError } = await supabase
      .from('team_members')
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (!updateError) {
      setTeamMembers((prev) => prev.map((m) => (m.id === id ? { ...m, role: newRole } : m)));
    }
  };

  const handleToggleMemberStatus = async (member: TeamMember) => {
    const newStatus = member.status === 'active' ? 'disabled' : 'active';
    const { error: updateError } = await supabase
      .from('team_members')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', member.id);
    if (!updateError) {
      setTeamMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, status: newStatus } : m)));
    }
  };

  const handleRemoveMember = async (id: string) => {
    const { error: deleteError } = await supabase
      .from('team_members')
      .delete()
      .eq('id', id);
    if (!deleteError) {
      setTeamMembers((prev) => prev.filter((m) => m.id !== id));
    }
  };

  const canSave = activeTab === 'email'
    ? smtpServersList.length > 0
    : activeTab === 'telegram' ? true
    : activeTab === 'whatsapp' ? Boolean(waPhoneNumberId.trim() && waAccessToken.trim()) || waNumbersList.length > 0
    : activeTab === 'account' ? Boolean(firstName.trim() || lastName.trim() || phoneNumber.trim() || addressLine.trim() || area.trim() || pinCode.trim())
    : activeTab === 'followup' ? reminderEmails.some((e) => e.trim())
    : activeTab === 'meta' ? Boolean(metaPixelId.trim() && metaAccessToken.trim())
    : activeTab === 'assignment' ? true
    : activeTab === 'role_management' ? true
    : activeTab === 'section_visibility' ? true
    : false;

  const tabs: { key: typeof activeTab; label: string; icon: React.ReactNode; accent: string; show: boolean }[] = [
    { key: 'account', label: 'Account', icon: <Users size={18} />, accent: 'account', show: true },
    { key: 'email', label: 'Email (SMTP)', icon: <Mail size={18} />, accent: 'email', show: true },
    { key: 'scheduled_emails', label: 'Scheduled Emails', icon: <CalendarClock size={18} />, accent: 'scheduled_emails', show: true },
    { key: 'telegram', label: 'Telegram Bot', icon: <MessageCircle size={18} />, accent: 'telegram', show: true },
    { key: 'whatsapp', label: 'WhatsApp API', icon: <PhoneIcon size={18} />, accent: 'whatsapp', show: true },
    { key: 'twilio', label: 'Virtual Calling', icon: <PhoneCall size={18} />, accent: 'twilio', show: true },
    { key: 'team', label: 'Team', icon: <Users size={18} />, accent: 'team', show: permissions.teamManagement },
    { key: 'team_dashboard', label: 'Team Dashboard', icon: <Activity size={18} />, accent: 'team_dashboard', show: permissions.teamManagement },
    { key: 'role_management', label: 'Role Management', icon: <SlidersHorizontal size={18} />, accent: 'role_management', show: permissions.teamManagement },
    { key: 'lead_distribution', label: 'Lead Distribution', icon: <Shuffle size={18} />, accent: 'lead_distribution', show: permissions.teamManagement },
    { key: 'pipeline_autoassign', label: 'Pipeline Auto-Assign', icon: <GitBranch size={18} />, accent: 'pipeline_autoassign', show: permissions.teamManagement },
    { key: 'pipeline_stages', label: 'Pipeline Stage Labels', icon: <Tag size={18} />, accent: 'pipeline_stages', show: permissions.settings },
    { key: 'assignment', label: 'Lead Assignment', icon: <Shuffle size={18} />, accent: 'assignment', show: permissions.teamManagement },
    { key: 'followup', label: 'Follow-Ups', icon: <Bell size={18} />, accent: 'followup', show: true },

    { key: 'meta', label: 'Meta Ads', icon: <TrendingUp size={18} />, accent: 'meta', show: true },

    { key: 'section_visibility', label: 'Section Visibility', icon: <Eye size={18} />, accent: 'section_visibility', show: permissions.settings },
    { key: 'recycle_bin', label: 'Recycle Bin', icon: <Trash2 size={18} />, accent: 'recycle_bin', show: permissions.deleteLeads },
    { key: 'billing', label: 'Billing & Plans', icon: <CreditCard size={18} />, accent: 'billing', show: billingModeEnabled },
    { key: 'danger', label: 'Delete Account', icon: <Trash2 size={18} />, accent: 'danger', show: true },
  ];

  return (
    <>
    <div className="crm-settings-page">
      <div className="crm-settings-header">
        <div className="crm-settings-header-left">
          <button className="crm-settings-back-btn" onClick={onBack} aria-label="Back to dashboard">
            <ArrowLeft size={20} />
          </button>
          <div className="crm-settings-header-icon">
            <SettingsIcon size={22} />
          </div>
          <div>
            <h1>Settings</h1>
            <p>Manage your account, integrations, and team</p>
          </div>
        </div>
        <button
          onClick={onSignOut}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 16px', border: '1px solid var(--border-subtle)', borderRadius: '10px', background: 'var(--bg-card)', color: 'var(--text-dark)', fontSize: '0.83rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0 }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#EF4444'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#EF4444'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.color = 'var(--text-dark)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
        >
          <LogOut size={18} /> Sign Out
        </button>
      </div>

      <div className="crm-settings-body">
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
              <Loader2 size={28} className="crm-spin" style={{ color: '#0f766e' }} />
            </div>
          ) : (
            <>
              {/* Vertical Sidebar */}
              <nav className="crm-settings-sidebar">
                {tabs.filter((t) => t.show).map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    data-accent={t.accent}
                    className={`crm-settings-tab ${activeTab === t.key ? 'crm-settings-tab-active' : ''}`}
                    onClick={() => { setActiveTab(t.key); setError(''); setSaved(false); setAccountSaved(false); setAccountError(''); }}
                  >
                    <span className="crm-settings-tab-icon">{t.icon}</span>
                    <span className="crm-settings-tab-label">{t.label}</span>
                  </button>
                ))}
              </nav>

              {/* Content Panel */}
              <div className="crm-settings-content">
                <div className="crm-settings-card">
              {activeTab === 'account' ? (
                <>
                  <div className="crm-settings-card-header">
                    <h2 className="crm-settings-card-title"><Users size={20} style={{ color: '#2563eb' }} /> Account Information</h2>
                    <p className="crm-settings-card-desc">Update your personal details. This information is associated with your account.</p>
                  </div>

                  {/* Profile avatar preview */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: 'var(--bg-light)', borderRadius: '10px', border: '1px solid var(--border-subtle)', marginBottom: '20px' }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div style={{ width: '64px', height: '64px', borderRadius: '50%', overflow: 'hidden', background: 'linear-gradient(135deg, #2563eb, #1e40af)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bg-card)', fontWeight: 700, fontSize: '1.3rem', border: '2px solid var(--border-subtle)' }}>
                        {profilePicUrl ? (
                          <img src={profilePicUrl} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          (firstName || lastName || accountEmail)[0]?.toUpperCase() || '?'
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => profilePicInputRef.current?.click()}
                        disabled={uploadingPic}
                        aria-label="Upload profile picture"
                        style={{
                          position: 'absolute', bottom: '-2px', right: '-2px',
                          width: '26px', height: '26px', borderRadius: '50%',
                          border: '2px solid #fff', background: '#2563eb', color: 'var(--bg-card)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: uploadingPic ? 'not-allowed' : 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                          opacity: uploadingPic ? 0.6 : 1, transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => { if (!uploadingPic) e.currentTarget.style.background = '#1e40af'; }}
                        onMouseLeave={(e) => { if (!uploadingPic) e.currentTarget.style.background = '#2563eb'; }}
                      >
                        {uploadingPic ? <Loader2 size={13} className="crm-spin" /> : <Camera size={13} />}
                      </button>
                      <input
                        ref={profilePicInputRef}
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 5 * 1024 * 1024) {
                            setAccountError('Image must be under 5MB.');
                            return;
                          }
                          setUploadingPic(true);
                          setAccountError('');
                          try {
                            const fileExt = file.name.split('.').pop() || 'jpg';
                            const filePath = `${session.user.id}/${Date.now()}.${fileExt}`;
                            const { error: upErr } = await supabase.storage
                              .from('profile-pics')
                              .upload(filePath, file, { cacheControl: '3600', upsert: false });
                            if (upErr) {
                              setAccountError(upErr.message);
                              setUploadingPic(false);
                              return;
                            }
                            const { data: urlData } = supabase.storage
                              .from('profile-pics')
                              .getPublicUrl(filePath);
                            setProfilePicUrl(urlData.publicUrl);
                            setAccountSaved(false);
                          } catch {
                            setAccountError('Failed to upload image.');
                          }
                          setUploadingPic(false);
                          if (profilePicInputRef.current) profilePicInputRef.current.value = '';
                        }}
                        style={{ display: 'none' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <strong style={{ fontSize: '0.9rem', display: 'block' }}>
                        {firstName || lastName ? `${firstName} ${lastName}`.trim() : 'Your Name'}
                      </strong>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-dark)' }}>{accountEmail}</span>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-dark)', marginTop: '4px' }}>Click the camera icon to upload a profile picture. Don't forget to save.</p>
                    </div>
                    {profilePicUrl && (
                      <button
                        type="button"
                        onClick={() => { setProfilePicUrl(null); setAccountSaved(false); }}
                        disabled={uploadingPic}
                        style={{ padding: '6px 12px', border: '1px solid var(--border-subtle)', borderRadius: '6px', background: 'var(--bg-card)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, color: '#dc2626', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
                      >
                        <Trash2 size={12} /> Remove
                      </button>
                    )}
                  </div>

                  <div className="crm-add-lead-grid">
                    <label className="crm-add-lead-field">
                      <span>First Name</span>
                      <input type="text" value={firstName} onChange={(e) => { setFirstName(e.target.value); setAccountSaved(false); }} placeholder="John" />
                    </label>
                    <label className="crm-add-lead-field">
                      <span>Last Name</span>
                      <input type="text" value={lastName} onChange={(e) => { setLastName(e.target.value); setAccountSaved(false); }} placeholder="Doe" />
                    </label>
                    <label className="crm-add-lead-field">
                      <span>Phone Number</span>
                      <input type="tel" value={phoneNumber} onChange={(e) => { setPhoneNumber(e.target.value); setAccountSaved(false); }} placeholder="+1 234 567 8900" />
                    </label>
                    <label className="crm-add-lead-field">
                      <span>Email Address</span>
                      <input type="email" value={accountEmail} disabled style={{ background: 'var(--bg-light)', cursor: 'not-allowed', color: 'var(--text-dark)' }} />
                    </label>
                    <label className="crm-add-lead-field" style={{ gridColumn: '1 / -1' }}>
                      <span>Address Line</span>
                      <input type="text" value={addressLine} onChange={(e) => { setAddressLine(e.target.value); setAccountSaved(false); }} placeholder="Flat / House no, Building, Street" />
                    </label>
                    <label className="crm-add-lead-field">
                      <span>Area / Locality</span>
                      <input type="text" value={area} onChange={(e) => { setArea(e.target.value); setAccountSaved(false); }} placeholder="Area, City, State" />
                    </label>
                    <label className="crm-add-lead-field">
                      <span>PIN Code</span>
                      <input type="text" value={pinCode} onChange={(e) => { setPinCode(e.target.value); setAccountSaved(false); }} placeholder="e.g. 560001" inputMode="numeric" maxLength={10} />
                    </label>
                  </div>

                  {accountError && (
                    <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '12px 16px', color: '#dc2626', fontSize: '0.85rem', fontWeight: 600, marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AlertTriangle size={16} /> {accountError}
                    </div>
                  )}

                  {accountSaved && (
                    <div style={{ background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.3)', borderRadius: '8px', padding: '12px 16px', color: '#16a34a', fontSize: '0.85rem', fontWeight: 600, marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={16} /> Account details saved successfully.
                    </div>
                  )}
                </>
              ) : activeTab === 'twilio' ? (
                <>
                  <div className="crm-settings-card-header">
                    <h2 className="crm-settings-card-title"><PhoneCall size={20} style={{ color: '#0d9488' }} /> Virtual Calling</h2>
                    <p className="crm-settings-card-desc">Connect a virtual number provider to call leads directly from the CRM. Your personal number stays private — calls go through the provider's servers.</p>
                  </div>

                  {/* Provider selector */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                    {([
                      { key: 'twilio', label: 'Twilio', desc: 'Global, developer-friendly', color: '#F22FAF', url: 'https://www.twilio.com' },
                      { key: 'exotel', label: 'Exotel', desc: 'Best for India, Indian +91 numbers', color: '#0d9488', url: 'https://www.exotel.com' },
                      { key: 'plivo', label: 'Plivo', desc: 'Global, competitive pricing', color: '#2563eb', url: 'https://www.plivo.com' },
                    ] as const).map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => setCallProvider(p.key)}
                        style={{
                          padding: '12px 16px',
                          border: callProvider === p.key ? `2px solid ${p.color}` : '1px solid var(--border-subtle)',
                          borderRadius: '10px',
                          background: callProvider === p.key ? `${p.color}10` : 'var(--bg-card)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          gap: '2px',
                          transition: 'all 0.2s',
                          flex: '1',
                          minWidth: '140px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.color }} />
                          <strong style={{ fontSize: '0.85rem', color: callProvider === p.key ? p.color : 'var(--text-main)' }}>{p.label}</strong>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-dark)' }}>{p.desc}</span>
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', padding: '14px 16px', background: 'rgba(13,148,136,0.06)', border: '1px solid rgba(13,148,136,0.2)', borderRadius: '10px', marginBottom: '20px', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    <PhoneCall size={16} style={{ color: '#0d9488', flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <strong style={{ color: '#0f766e' }}>How it works:</strong> When you dial a lead from the CRM, {callProvider === 'twilio' ? 'Twilio' : callProvider === 'exotel' ? 'Exotel' : 'Plivo'} first calls your phone (the agent number below). When you pick up, it connects you to the lead — so both of you see the virtual number, not each other's real numbers. Get started at{' '}
                      <a href={callProvider === 'twilio' ? 'https://www.twilio.com' : callProvider === 'exotel' ? 'https://www.exotel.com' : 'https://www.plivo.com'} target="_blank" rel="noopener noreferrer" style={{ color: '#0d9488', textDecoration: 'underline' }}>
                        {callProvider === 'twilio' ? 'twilio.com' : callProvider === 'exotel' ? 'exotel.com' : 'plivo.com'}
                      </a>.
                    </div>
                  </div>

                  {/* Collapsible step-by-step setup guide */}
                  <div style={{ marginBottom: '20px', border: '1px solid var(--border-subtle)', borderRadius: '10px', overflow: 'hidden' }}>
                    <button
                      type="button"
                      onClick={() => setShowCallingGuide(!showCallingGuide)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '14px 16px', border: 'none', background: 'var(--bg-light)', cursor: 'pointer',
                        fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <BookOpen size={16} style={{ color: '#0d9488' }} />
                        Step-by-Step Setup Guide ({callProvider === 'twilio' ? 'Twilio' : callProvider === 'exotel' ? 'Exotel' : 'Plivo'})
                      </span>
                      {showCallingGuide ? <ChevronUp size={18} style={{ color: 'var(--text-dark)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-dark)' }} />}
                    </button>
                    {showCallingGuide && (
                      <div style={{ padding: '16px', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                        {callProvider === 'twilio' && (
                          <>
                            <p style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>Twilio Setup</p>
                            <ol style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <li><strong>Create a Twilio account</strong> — Go to <a href="https://www.twilio.com" target="_blank" rel="noopener noreferrer" style={{ color: '#0d9488' }}>twilio.com</a>, sign up, and verify your email and phone number. You get trial credits to test with.</li>
                              <li><strong>Copy your Account SID and Auth Token</strong> — In the <a href="https://console.twilio.com" target="_blank" rel="noopener noreferrer" style={{ color: '#0d9488' }}>Twilio Console</a>, your Account SID (starts with "AC") and Auth Token are on the dashboard home page. Click the eye icon to reveal the Auth Token.</li>
                              <li><strong>Buy a phone number</strong> — Go to Phone Numbers &gt; Buy a number. Make sure it has <em>Voice</em> capability. Numbers cost $1–$15/month depending on country.</li>
                              <li><strong>Upgrade from trial</strong> — Trial accounts can only call verified numbers. Go to Billing &gt; Upgrade, add a credit card, and your account can call any number.</li>
                              <li><strong>Enter credentials below</strong> — Paste your Account SID, Auth Token, Twilio phone number (E.164 format like +12345678901), and your real phone number as the Agent Number.</li>
                              <li><strong>Test a call</strong> — Open any lead, click Call, and pick up your phone when it rings. The system then connects you to the lead.</li>
                            </ol>
                            <p style={{ marginTop: '10px', padding: '10px 12px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: '6px', fontSize: '0.78rem', color: '#854d0e' }}><strong>Note:</strong> Twilio does not sell Indian +91 numbers to most businesses. If you need an Indian number, use Exotel instead.</p>
                          </>
                        )}
                        {callProvider === 'exotel' && (
                          <>
                            <p style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>Exotel Setup</p>
                            <ol style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <li><strong>Create an Exotel account</strong> — Go to <a href="https://www.exotel.com" target="_blank" rel="noopener noreferrer" style={{ color: '#0d9488' }}>exotel.com</a> and sign up. Exotel may require business verification for Indian numbers.</li>
                              <li><strong>Get your API credentials</strong> — In the Exotel dashboard, go to Settings &gt; API. Copy your <strong>Account SID</strong> (a short name like "yourcompany") and <strong>Auth Token</strong>.</li>
                              <li><strong>Get a virtual number (DID)</strong> — Go to Numbers &gt; DID Numbers and buy or assign a number. These are Indian +91 numbers.</li>
                              <li><strong>Complete business verification</strong> — Exotel requires KYC verification before numbers are active. Contact Exotel support if this is pending.</li>
                              <li><strong>Enter credentials below</strong> — Paste your Exotel SID, Auth Token, virtual number (E.164 format like +918012345678), and your real phone number as the Agent Number.</li>
                              <li><strong>Test a call</strong> — Open any lead, click Call, and pick up your phone when it rings.</li>
                            </ol>
                            <p style={{ marginTop: '10px', padding: '10px 12px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: '6px', fontSize: '0.78rem', color: '#854d0e' }}><strong>Note:</strong> Exotel handles Indian DND (Do Not Disturb) compliance automatically — best choice for India-based calling.</p>
                          </>
                        )}
                        {callProvider === 'plivo' && (
                          <>
                            <p style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>Plivo Setup</p>
                            <ol style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <li><strong>Create a Plivo account</strong> — Go to <a href="https://www.plivo.com" target="_blank" rel="noopener noreferrer" style={{ color: '#0d9488' }}>plivo.com</a>, sign up, and verify your email and phone. You get free trial credits.</li>
                              <li><strong>Copy your Auth ID and Auth Token</strong> — In the <a href="https://console.plivo.com" target="_blank" rel="noopener noreferrer" style={{ color: '#0d9488' }}>Plivo Console</a>, go to Overview or Credentials. Copy the <strong>Auth ID</strong> and <strong>Auth Token</strong>.</li>
                              <li><strong>Buy a phone number</strong> — Go to Phone Numbers &gt; Buy Number. Ensure it has <em>Voice</em> capability. Numbers cost $0.80–$3.00/month.</li>
                              <li><strong>Add credits</strong> — Trial accounts can only call verified numbers. Go to Billing &gt; Add Credits and add at least $10 to go live.</li>
                              <li><strong>Enter credentials below</strong> — Paste your Auth ID, Auth Token, Plivo phone number (E.164 format like +12345678901), and your real phone number as the Agent Number.</li>
                              <li><strong>Test a call</strong> — Open any lead, click Call, and pick up your phone when it rings.</li>
                            </ol>
                            <p style={{ marginTop: '10px', padding: '10px 12px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: '6px', fontSize: '0.78rem', color: '#854d0e' }}><strong>Note:</strong> Plivo often has lower per-minute rates than Twilio — good for cost-conscious teams.</p>
                          </>
                        )}
                        <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)' }}>
                          <p style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>Phone Number Format (E.164)</p>
                          <p style={{ fontSize: '0.78rem' }}>All phone numbers must start with <strong>+</strong> followed by the country code and full number — no spaces, dashes, or parentheses.</p>
                          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '6px' }}>
                            <code style={{ fontSize: '0.72rem', background: 'var(--bg-light)', padding: '2px 6px', borderRadius: '4px' }}>+919876543210</code>
                            <code style={{ fontSize: '0.72rem', background: 'var(--bg-light)', padding: '2px 6px', borderRadius: '4px' }}>+12125551234</code>
                            <code style={{ fontSize: '0.72rem', background: 'var(--bg-light)', padding: '2px 6px', borderRadius: '4px' }}>+447911123456</code>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="crm-add-lead-grid">
                    <label className="crm-add-lead-field">
                      <span>{callProvider === 'twilio' ? 'Account SID' : callProvider === 'exotel' ? 'Exotel SID' : 'Auth ID'} <em>*</em></span>
                      <input type="text" required value={twilioAccountSid} onChange={(e) => setTwilioAccountSid(e.target.value)} placeholder={callProvider === 'twilio' ? 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' : callProvider === 'exotel' ? 'yourcompany' : 'MAxxxxxxxxxxxxxxxxxxxxxxxx'} />
                    </label>
                    <label className="crm-add-lead-field">
                      <span>{callProvider === 'plivo' ? 'Auth Token' : 'Auth Token'} <em>*</em></span>
                      <div style={{ position: 'relative' }}>
                        <input type={showTwilioToken ? 'text' : 'password'} required value={twilioAuthToken} onChange={(e) => setTwilioAuthToken(e.target.value)} placeholder={`Your ${callProvider === 'twilio' ? 'Twilio' : callProvider === 'exotel' ? 'Exotel' : 'Plivo'} token`} style={{ width: '100%', paddingRight: '40px' }} />
                        <button type="button" onClick={() => setShowTwilioToken(!showTwilioToken)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-dark)', fontSize: '0.75rem', padding: '4px' }}>
                          {showTwilioToken ? 'Hide' : 'Show'}
                        </button>
                      </div>
                    </label>
                    <label className="crm-add-lead-field" style={{ gridColumn: '1 / -1' }}>
                      <span>{callProvider === 'twilio' ? 'Twilio Phone Number' : callProvider === 'exotel' ? 'Exotel Virtual Number' : 'Plivo Phone Number'} <em>*</em></span>
                      <input type="tel" required value={twilioNumber} onChange={(e) => setTwilioNumber(e.target.value)} placeholder={callProvider === 'exotel' ? '+91XXXXXXXXXX (Indian number)' : '+12345678901 (E.164 format)'} />
                    </label>
                    <label className="crm-add-lead-field" style={{ gridColumn: '1 / -1' }}>
                      <span>Your Phone Number (Agent) <em>*</em></span>
                      <input type="tel" required value={agentNumber} onChange={(e) => setAgentNumber(e.target.value)} placeholder="+91XXXXXXXXXX — your phone that receives the call first" />
                    </label>
                  </div>

                  {twilioCallLogs.length > 0 && (
                    <div style={{ marginTop: '24px' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <History size={16} style={{ color: '#0d9488' }} /> Recent Calls
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '240px', overflowY: 'auto' }}>
                        {twilioCallLogs.map((log) => (
                          <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'var(--bg-light)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(13,148,136,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <PhoneOutgoing size={15} style={{ color: '#0d9488' }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <strong style={{ fontSize: '0.82rem', display: 'block' }}>{log.lead_name || log.phone_number}</strong>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-dark)' }}>{log.phone_number} — {new Date(log.created_at).toLocaleString()}</span>
                            </div>
                            <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', padding: '2px 8px', borderRadius: '4px', whiteSpace: 'nowrap', background: log.status === 'completed' ? 'rgba(22,163,74,0.15)' : log.status === 'failed' || log.status === 'no-answer' || log.status === 'busy' ? 'rgba(239,68,68,0.15)' : 'rgba(234,179,8,0.15)', color: log.status === 'completed' ? '#16a34a' : log.status === 'failed' || log.status === 'no-answer' || log.status === 'busy' ? '#dc2626' : '#854d0e' }}>
                              {log.status}
                            </span>
                            {log.duration > 0 && <span style={{ fontSize: '0.72rem', color: 'var(--text-dark)', whiteSpace: 'nowrap' }}>{log.duration}s</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : activeTab === 'team' ? (
                <>
                  <div className="crm-settings-card-header">
                    <h2 className="crm-settings-card-title"><Users size={20} style={{ color: '#7c3aed' }} /> Team Management</h2>
                    <p className="crm-settings-card-desc">Invite employees to your CRM by email and assign them a role. They can sign up with the invited email to get access.</p>
                  </div>

                  {/* Invite form */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => { setInviteEmail(e.target.value); setTeamError(''); setTeamSuccess(''); }}
                      placeholder="employee@company.com"
                      style={{ flex: '1', minWidth: '200px', padding: '10px 14px', border: '1px solid var(--border-subtle)', borderRadius: '8px', fontSize: '0.85rem' }}
                    />
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as 'admin' | 'manager' | 'agent')}
                      style={{ padding: '10px 14px', border: '1px solid var(--border-subtle)', borderRadius: '8px', fontSize: '0.85rem', cursor: 'pointer' }}
                    >
                      <option value="agent">Agent (view leads only)</option>
                      <option value="manager">Manager (leads + inbox)</option>
                      <option value="admin">Admin (full access)</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleInviteMember}
                      disabled={!inviteEmail.trim() || inviting}
                      style={{ padding: '10px 20px', border: 'none', borderRadius: '8px', background: '#7c3aed', color: 'var(--bg-card)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                    >
                      {inviting ? <Loader2 size={16} className="crm-spin" /> : <Plus size={16} />}
                      {inviting ? 'Inviting...' : 'Invite'}
                    </button>
                  </div>

                  {teamError && (
                    <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', color: '#dc2626', fontSize: '0.82rem', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AlertTriangle size={16} /> {teamError}
                    </div>
                  )}

                  {teamSuccess && (
                    <div style={{ background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.3)', borderRadius: '8px', padding: '10px 14px', color: '#16a34a', fontSize: '0.82rem', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={16} /> {teamSuccess}
                    </div>
                  )}

                  {/* Role legend */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
                    {([
                      { role: 'admin', label: 'Admin', desc: 'Full access', color: '#dc2626' },
                      { role: 'manager', label: 'Manager', desc: 'Leads + Inbox', color: '#2563eb' },
                      { role: 'agent', label: 'Agent', desc: 'View leads only', color: 'var(--text-dark)' },
                    ] as const).map((r) => (
                      <div key={r.role} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: 'var(--bg-light)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: r.color }} />
                        <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{r.label}</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-dark)' }}>{r.desc}</span>
                      </div>
                    ))}
                  </div>

                  {/* Team members list */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {teamMembers.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-dark)' }}>
                        <Users size={32} style={{ marginBottom: '8px', opacity: 0.4 }} />
                        <p style={{ fontSize: '0.85rem' }}>No team members yet. Invite your first employee above.</p>
                      </div>
                    ) : (
                      teamMembers.map((member) => (
                        <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'var(--bg-light)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: member.status === 'disabled' ? 'var(--border-subtle)' : member.role === 'admin' ? 'rgba(220,38,38,0.15)' : member.role === 'manager' ? 'rgba(37,99,235,0.15)' : 'rgba(100,116,139,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', color: member.status === 'disabled' ? '#94a3b8' : member.role === 'admin' ? '#dc2626' : member.role === 'manager' ? '#2563eb' : 'var(--text-dark)', flexShrink: 0 }}>
                            {member.email[0]?.toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <strong style={{ fontSize: '0.85rem', truncate: true, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.email}</strong>
                              <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', padding: '2px 8px', borderRadius: '4px', whiteSpace: 'nowrap', background: member.status === 'active' ? 'rgba(22,163,74,0.15)' : member.status === 'pending' ? 'rgba(234,179,8,0.15)' : 'rgba(239,68,68,0.15)', color: member.status === 'active' ? '#16a34a' : member.status === 'pending' ? '#854d0e' : '#dc2626' }}>
                                {member.status}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                              <select
                                value={member.role}
                                onChange={(e) => handleUpdateMemberRole(member.id, e.target.value as 'admin' | 'manager' | 'agent')}
                                style={{ fontSize: '0.75rem', padding: '3px 8px', border: '1px solid var(--border-subtle)', borderRadius: '4px', cursor: 'pointer', background: 'var(--bg-card)' }}
                              >
                                <option value="agent">Agent</option>
                                <option value="manager">Manager</option>
                                <option value="admin">Admin</option>
                              </select>
                              {member.full_name && <span style={{ fontSize: '0.72rem', color: 'var(--text-dark)' }}>{member.full_name}</span>}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                            {member.status === 'pending' && (
                              <button
                                type="button"
                                onClick={() => handleResendInvite(member)}
                                disabled={inviting}
                                title="Resend invite email"
                                style={{ padding: '6px 10px', border: '1px solid var(--border-subtle)', borderRadius: '6px', background: 'var(--bg-card)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, color: '#2563eb', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}
                              >
                                <Send size={13} /> Resend
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleToggleMemberStatus(member)}
 title={member.status === 'active' ? 'Disable access' : 'Enable access'}
                              style={{ padding: '6px 10px', border: '1px solid var(--border-subtle)', borderRadius: '6px', background: 'var(--bg-card)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, color: member.status === 'active' ? '#dc2626' : '#16a34a', whiteSpace: 'nowrap' }}
                            >
                              {member.status === 'active' ? 'Disable' : 'Enable'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(member.id)}
                              title="Remove member"
                              style={{ padding: '6px 10px', border: '1px solid var(--border-subtle)', borderRadius: '6px', background: 'var(--bg-card)', cursor: 'pointer', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {userRole !== 'owner' && (
                    <div style={{ marginTop: '16px', padding: '12px 16px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: '8px', color: '#854d0e', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AlertTriangle size={14} /> Only the account owner can manage team members.
                    </div>
                  )}
                </>
              ) : activeTab === 'team_dashboard' ? (
                <TeamDashboardPanel session={session} />
              ) : activeTab === 'role_management' ? (
                <>
                  <div className="crm-settings-card-header">
                    <h2 className="crm-settings-card-title"><SlidersHorizontal size={20} style={{ color: '#7c3aed' }} /> Role Management</h2>
                    <p className="crm-settings-card-desc">Customize what each role can access. Toggle individual feature permissions for Admin, Manager, and Agent roles. Changes take effect when team members next log in.</p>
                  </div>

                  {/* Role selector */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                    {([
                      { role: 'admin', label: 'Admin', color: '#dc2626' },
                      { role: 'manager', label: 'Manager', color: '#2563eb' },
                      { role: 'agent', label: 'Agent', color: 'var(--text-dark)' },
                    ] as const).map((r) => (
                      <button
                        key={r.role}
                        type="button"
                        onClick={() => setSelectedRoleForEditing(r.role)}
                        style={{
                          padding: '10px 20px',
                          border: selectedRoleForEditing === r.role ? `2px solid ${r.color}` : '1px solid var(--border-subtle)',
                          borderRadius: '10px',
                          background: selectedRoleForEditing === r.role ? `${r.color}15` : 'var(--bg-card)',
                          color: selectedRoleForEditing === r.role ? r.color : 'var(--text-dark)',
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          transition: 'all 0.2s',
                        }}
                      >
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: r.color }} />
                        {r.label}
                      </button>
                    ))}
                  </div>

                  {/* Permission toggles grouped */}
                  {(['Core', 'Features', 'Admin'] as const).map((group) => {
                    const groupPerms = PERMISSION_LABELS.filter((p) => p.group === group);
                    const groupColors: Record<string, string> = { Core: '#2563eb', Features: '#0891b2', Admin: '#7c3aed' };
                    return (
                      <div key={group} style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: groupColors[group], marginBottom: '8px', paddingLeft: '4px' }}>{group}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {groupPerms.map((perm) => {
                            const currentPerms = rolePerms[selectedRoleForEditing] || ROLE_PERMISSIONS[selectedRoleForEditing];
                            const value = currentPerms[perm.key];
                            return (
                              <div
                                key={perm.key}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '14px 16px',
                                  background: value ? `${groupColors[group]}08` : 'var(--bg-light)',
                                  borderRadius: '10px',
                                  border: `1px solid ${value ? `${groupColors[group]}30` : 'var(--border-subtle)'}`,
                                  transition: 'all 0.2s',
                                }}
                              >
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '2px' }}>{perm.label}</div>
                                  <div style={{ fontSize: '0.76rem', color: 'var(--text-dark)' }}>{perm.desc}</div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRolePerms((prev) => ({
                                      ...prev,
                                      [selectedRoleForEditing]: {
                                        ...(prev[selectedRoleForEditing] || ROLE_PERMISSIONS[selectedRoleForEditing]),
                                        [perm.key]: !value,
                                      },
                                    }));
                                  }}
                                  style={{
                                    width: '44px',
                                    height: '24px',
                                    borderRadius: '12px',
                                    border: 'none',
                                    background: value ? groupColors[group] : 'var(--text-dark)',
                                    cursor: 'pointer',
                                    position: 'relative',
                                    transition: 'background 0.2s',
                                    flexShrink: 0,
                                  }}
                                >
                                  <div style={{
                                    position: 'absolute',
                                    top: '2px',
                                    left: value ? '22px' : '2px',
                                    width: '20px',
                                    height: '20px',
                                    borderRadius: '50%',
                                    background: 'var(--bg-card)',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                    transition: 'left 0.2s',
                                  }} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {rolePermsError && (
                    <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '12px 16px', color: '#dc2626', fontSize: '0.85rem', fontWeight: 600, marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AlertTriangle size={16} /> {rolePermsError}
                    </div>
                  )}

                  {rolePermsSaved && (
                    <div style={{ background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.3)', borderRadius: '8px', padding: '12px 16px', color: '#16a34a', fontSize: '0.85rem', fontWeight: 600, marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={16} /> Role permissions saved successfully. Team members will see the updated permissions on their next login.
                    </div>
                  )}

                  <div style={{ marginTop: '16px', padding: '12px 16px', background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: '8px', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <SlidersHorizontal size={14} style={{ color: '#7c3aed', flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <strong>Note:</strong> The Owner role always has full access and cannot be customized. Changes saved here override the default role permissions. If you haven't customized a role, the default permissions apply.
                    </div>
                  </div>
                </>
              ) : activeTab === 'email' ? (
                <>
                  <div className="crm-settings-card-header">
                    <h2 className="crm-settings-card-title"><Mail size={20} style={{ color: '#2563eb' }} /> SMTP Servers</h2>
                    <p className="crm-settings-card-desc">Add multiple SMTP servers for sending emails. Servers are tried in priority order — if the first fails, the next is used automatically. For Gmail, use an App Password (not your regular password).</p>
                  </div>

                  {/* SMTP servers list */}
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Mail size={16} style={{ color: '#2563eb' }} />
                        <strong style={{ fontSize: '0.85rem' }}>Configured SMTP Servers ({smtpServersList.length})</strong>
                      </div>
                      {editingSmtpServerId === null && smtpServerHost.trim() === '' ? (
                        <button type="button" onClick={() => { resetSmtpServerForm(); }} style={{ fontSize: '0.78rem', fontWeight: 600, color: '#2563eb', border: '1px solid #2563eb', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', background: 'var(--bg-card)' }}>+ Add Server</button>
                      ) : (
                        <button type="button" onClick={resetSmtpServerForm} style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-dark)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', background: 'var(--bg-card)' }}>Cancel</button>
                      )}
                    </div>
                    {smtpServersList.length === 0 ? (
                      <div style={{ padding: '20px', textAlign: 'center', background: 'var(--bg-light)', borderRadius: '10px', border: '1px dashed var(--border-subtle)' }}>
                        <Mail size={32} style={{ color: 'var(--text-dark)', margin: '0 auto 8px', display: 'block' }} />
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-dark)' }}>No SMTP servers configured yet. Add your first server using the form below.</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {smtpServersList.map((s, idx) => (
                          <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-light)', borderRadius: '10px', border: editingSmtpServerId === s.id ? '2px solid #2563eb' : '1px solid var(--border-subtle)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #2563eb, #1e40af)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bg-card)', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>
                                {idx + 1}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {s.label || s.smtp_username}
                                  {idx === 0 && <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: 'rgba(37,99,235,0.15)', color: '#1e40af' }}>PRIMARY</span>}
                                  {!s.is_active && <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: 'rgba(100,116,139,0.15)', color: 'var(--text-muted)' }}>DISABLED</span>}
                                  {s.last_error && <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: 'rgba(239,68,68,0.15)', color: '#b91c1c' }} title={s.last_error}>ERROR</span>}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {s.smtp_host}:{s.smtp_port} · {s.smtp_username}
                                </div>
                                {(s.total_sent > 0 || s.total_failed > 0) && (
                                  <div style={{ fontSize: '0.68rem', color: 'var(--text-dark)', marginTop: '2px' }}>
                                    Sent: {s.total_sent} · Failed: {s.total_failed}
                                    {s.daily_limit && ` · Limit: ${s.daily_limit}/day`}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                              <button type="button" onClick={() => handleToggleSmtpServer(s)} style={{ fontSize: '0.72rem', fontWeight: 600, color: s.is_active ? '#16a34a' : 'var(--text-dark)', border: `1px solid ${s.is_active ? 'rgba(22,163,74,0.3)' : 'var(--border-subtle)'}`, borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', background: 'var(--bg-card)' }}>
                                {s.is_active ? 'Enabled' : 'Disabled'}
                              </button>
                              <button type="button" onClick={() => startEditSmtpServer(s)} style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Edit3 size={12} /> Edit
                              </button>
                              <button type="button" onClick={() => handleDeleteSmtpServer(s.id)} disabled={deletingSmtpServerId === s.id} style={{ fontSize: '0.75rem', fontWeight: 600, color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {deletingSmtpServerId === s.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Add / Edit SMTP server form — show when adding or editing */}
                  {(editingSmtpServerId !== null || smtpServerHost.trim() !== '') && (
                  <div style={{ marginBottom: '20px', padding: '20px', background: 'var(--bg-card)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                      <Plus size={16} style={{ color: '#2563eb' }} />
                      <strong style={{ fontSize: '0.85rem' }}>{editingSmtpServerId ? 'Edit SMTP Server' : 'Add New SMTP Server'}</strong>
                    </div>
                    {smtpServerError && (
                      <div style={{ marginBottom: '10px', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', color: '#dc2626', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertTriangle size={14} /> {smtpServerError}
                      </div>
                    )}
                    {smtpServerSuccess && (
                      <div style={{ marginBottom: '10px', padding: '8px 12px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '6px', color: '#15803d', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CheckCircle2 size={14} /> Server saved successfully!
                      </div>
                    )}
                    <div className="crm-add-lead-grid">
                      <label className="crm-add-lead-field" style={{ gridColumn: '1 / -1' }}>
                        <span>Label <em>*</em></span>
                        <input type="text" value={smtpServerLabel} onChange={(e) => setSmtpServerLabel(e.target.value)} placeholder="e.g. Gmail, SendGrid, Office365" />
                      </label>
                      <label className="crm-add-lead-field">
                        <span>SMTP Host <em>*</em></span>
                        <input type="text" value={smtpServerHost} onChange={(e) => setSmtpServerHost(e.target.value)} placeholder="smtp.gmail.com" />
                      </label>
                      <label className="crm-add-lead-field">
                        <span>SMTP Port <em>*</em></span>
                        <input type="number" value={smtpServerPort} onChange={(e) => setSmtpServerPort(e.target.value)} placeholder="587" inputMode="numeric" />
                      </label>
                      <label className="crm-add-lead-field">
                        <span>SMTP Username <em>*</em></span>
                        <input type="email" value={smtpServerUsername} onChange={(e) => setSmtpServerUsername(e.target.value)} placeholder="you@yourcompany.com" />
                      </label>
                      <label className="crm-add-lead-field">
                        <span>SMTP Password {editingSmtpServerId ? '(leave blank to keep current)' : <em>*</em>}</span>
                        <div style={{ position: 'relative' }}>
                          <input type={showSmtpServerPassword ? 'text' : 'password'} value={smtpServerPassword} onChange={(e) => setSmtpServerPassword(e.target.value)} placeholder={editingSmtpServerId ? '••••••••' : 'App password or email password'} style={{ width: '100%', paddingRight: '40px' }} />
                          <button type="button" onClick={() => setShowSmtpServerPassword(!showSmtpServerPassword)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-dark)', fontSize: '0.75rem', padding: '4px' }}>
                            {showSmtpServerPassword ? 'Hide' : 'Show'}
                          </button>
                        </div>
                      </label>
                      <label className="crm-add-lead-field">
                        <span>From Email</span>
                        <input type="email" value={smtpServerFromEmail} onChange={(e) => setSmtpServerFromEmail(e.target.value)} placeholder="you@yourcompany.com" />
                      </label>
                      <label className="crm-add-lead-field">
                        <span>From Name</span>
                        <input type="text" value={smtpServerFromName} onChange={(e) => setSmtpServerFromName(e.target.value)} placeholder="Your Company Name" />
                      </label>
                      <label className="crm-add-lead-field">
                        <span>Daily Send Limit (optional)</span>
                        <input type="number" value={smtpServerDailyLimit} onChange={(e) => setSmtpServerDailyLimit(e.target.value)} placeholder="e.g. 500" inputMode="numeric" />
                      </label>
                    </div>
                    <label className="crm-add-lead-field" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px', marginTop: '12px' }}>
                      <input type="checkbox" checked={smtpServerUseTls} onChange={(e) => setSmtpServerUseTls(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#2563eb' }} />
                      <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>Use TLS / STARTTLS (recommended for port 587)</span>
                    </label>
                    <div style={{ marginTop: '14px', display: 'flex', gap: '8px' }}>
                      <button type="button" onClick={handleSaveSmtpServer} disabled={smtpServerSaving} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 20px', border: 'none', borderRadius: '8px', background: smtpServerSaving ? '#94a3b8' : '#2563eb', color: '#fff', fontSize: '0.82rem', fontWeight: 600, cursor: smtpServerSaving ? 'not-allowed' : 'pointer' }}>
                        {smtpServerSaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                        {smtpServerSaving ? 'Saving...' : editingSmtpServerId ? 'Update Server' : 'Add Server'}
                      </button>
                      <button type="button" onClick={resetSmtpServerForm} style={{ padding: '8px 16px', border: '1px solid var(--border-subtle)', borderRadius: '8px', background: 'var(--bg-card)', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </div>
                  )}

                </>
              ) : activeTab === 'whatsapp' ? (
                <>
                  <div className="crm-settings-card-header">
                    <h2 className="crm-settings-card-title"><PhoneIcon size={20} style={{ color: '#25D366' }} /> WhatsApp Business API</h2>
                    <p className="crm-settings-card-desc">Connect your WhatsApp Business Account to let clients message you on WhatsApp and reply directly from this CRM. You need a Meta Business account with the WhatsApp Business API enabled.</p>
                  </div>

                  {/* Multi-number list */}
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <PhoneIcon size={16} style={{ color: '#25D366' }} />
                        <strong style={{ fontSize: '0.85rem' }}>Connected WhatsApp Numbers ({waNumbersList.length})</strong>
                      </div>
                      {editingWaNumberId === null && waPhoneNumberId.trim() === '' ? null : (
                        <button type="button" onClick={resetWaForm} style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-dark)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', background: 'var(--bg-card)' }}>Cancel</button>
                      )}
                    </div>
                    {waNumbersList.length === 0 ? (
                      <div style={{ padding: '20px', textAlign: 'center', background: 'var(--bg-light)', borderRadius: '10px', border: '1px dashed var(--border-subtle)' }}>
                        <PhoneIcon size={32} style={{ color: 'var(--text-dark)', margin: '0 auto 8px', display: 'block' }} />
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-dark)' }}>No WhatsApp numbers connected yet. Add your first number using the form below.</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {waNumbersList.map((n, idx) => (
                          <div key={n.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-light)', borderRadius: '10px', border: editingWaNumberId === n.id ? '2px solid #25D366' : '1px solid var(--border-subtle)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #25D366, #128C7E)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bg-card)', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>
                                {idx + 1}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {n.label || n.connected_phone_number || n.phone_number_id}
                                  {idx === 0 && <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: 'rgba(37,211,102,0.15)', color: '#15803d' }}>PRIMARY</span>}
                                  {n.coex_enabled && <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: 'rgba(59,130,246,0.15)', color: '#2563EB', display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Smartphone size={9} /> APP SYNC</span>}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-dark)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {n.connected_phone_number ? `${n.connected_phone_number} · ` : ''}ID: {n.phone_number_id}
                                </div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, flexWrap: 'wrap' }}>
                              <button type="button" onClick={() => testWaToken(n.id)} disabled={waTestingId === n.id} style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0f766e', border: '1px solid rgba(15,118,110,0.2)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {waTestingId === n.id ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />} Test
                              </button>
                              <button type="button" onClick={() => startEditWaNumber(n)} style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Edit3 size={12} /> Edit
                              </button>
                              <button type="button" onClick={() => handleDeleteWaNumber(n.id)} disabled={deletingWaNumberId === n.id} style={{ fontSize: '0.75rem', fontWeight: 600, color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {deletingWaNumberId === n.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Delete
                              </button>
                            </div>
                          {waTestResult[n.id] && (
                            <div style={{ marginTop: '8px', padding: '8px 12px', borderRadius: '6px', fontSize: '0.76rem', lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: '6px', background: waTestResult[n.id].valid ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${waTestResult[n.id].valid ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`, color: waTestResult[n.id].valid ? '#15803d' : '#dc2626' }}>
                              {waTestResult[n.id].valid ? <CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: '1px' }} /> : <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />}
                              <span>{waTestResult[n.id].message}</span>
                            </div>
                          )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Quick Onboarding (embedded signup + manual) — only when adding new, not editing */}
                  {editingWaNumberId === null && (
                    <div style={{ marginBottom: '20px' }}>
                      <WhatsAppOnboarding
                        session={session}
                        onNumberAdded={async () => {
                          const { data: refreshed } = await supabase.from('whatsapp_settings').select('*').order('created_at', { ascending: true });
                          if (refreshed) setWaNumbersList(refreshed as WaNumberConfig[]);
                        }}
                      />
                    </div>
                  )}

                  {/* Add / Edit number form — only show when editing an existing number */}
                  {editingWaNumberId !== null && (
                  <div style={{ marginBottom: '20px', padding: '20px', background: 'var(--bg-card)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                      <Plus size={16} style={{ color: '#25D366' }} />
                      <strong style={{ fontSize: '0.85rem' }}>{editingWaNumberId ? 'Edit WhatsApp Number' : 'Add New WhatsApp Number'}</strong>
                    </div>
                    {waNumError && (
                      <div style={{ marginBottom: '10px', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', color: '#dc2626', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertTriangle size={14} /> {waNumError}
                      </div>
                    )}
                    {waNumSuccess && (
                      <div style={{ marginBottom: '10px', padding: '8px 12px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '6px', color: '#15803d', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CheckCircle2 size={14} /> Number saved successfully!
                      </div>
                    )}
                    <div className="crm-add-lead-grid">
                      <label className="crm-add-lead-field" style={{ gridColumn: '1 / -1' }}>
                        <span>Label (optional)</span>
                        <input type="text" value={waLabel} onChange={(e) => setWaLabel(e.target.value)} placeholder="e.g. Sales Line, Support Line" />
                        <small style={{ color: 'var(--text-dark)', fontSize: '0.74rem', marginTop: '4px', display: 'block' }}>
                          A friendly name to identify this number in the inbox filter.
                        </small>
                      </label>
                      <label className="crm-add-lead-field" style={{ gridColumn: '1 / -1' }}>
                        <span>Connected WhatsApp Number</span>
                        <input type="tel" value={waConnectedNumber} onChange={(e) => setWaConnectedNumber(e.target.value)} placeholder="e.g. +1234567890" />
                      </label>
                      <label className="crm-add-lead-field" style={{ gridColumn: '1 / -1' }}>
                        <span>Phone Number ID <em>*</em></span>
                        <input type="text" required value={waPhoneNumberId} onChange={(e) => setWaPhoneNumberId(e.target.value)} placeholder="123456789012345" style={{ fontFamily: 'monospace', fontSize: '0.82rem' }} />
                      </label>
                      <label className="crm-add-lead-field" style={{ gridColumn: '1 / -1' }}>
                        <span>Access Token <em>*</em></span>
                        <div style={{ position: 'relative' }}>
                          <input type={showWaToken ? 'text' : 'password'} required value={waAccessToken} onChange={(e) => setWaAccessToken(e.target.value)} placeholder="EAAxxxxxxxxxxxxxxxxx" style={{ width: '100%', paddingRight: '40px', fontFamily: 'monospace', fontSize: '0.82rem' }} />
                          <button type="button" onClick={() => setShowWaToken(!showWaToken)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-dark)', fontSize: '0.75rem', padding: '4px' }}>
                            {showWaToken ? 'Hide' : 'Show'}
                          </button>
                        </div>
                      </label>
                      <label className="crm-add-lead-field">
                        <span>WhatsApp Business Account ID</span>
                        <input type="text" value={waWabaId} onChange={(e) => setWaWabaId(e.target.value)} placeholder="Optional" style={{ fontFamily: 'monospace', fontSize: '0.82rem' }} />
                      </label>
                      <label className="crm-add-lead-field">
                        <span>Meta App ID</span>
                        <input type="text" value={waMetaAppId} onChange={(e) => setWaMetaAppId(e.target.value)} placeholder="Optional, for profile pics" style={{ fontFamily: 'monospace', fontSize: '0.82rem' }} />
                      </label>
                      <label className="crm-add-lead-field">
                        <span>Webhook Verify Token</span>
                        <input type="text" value={waVerifyToken} onChange={(e) => setWaVerifyToken(e.target.value)} placeholder="Auto-generated if empty" style={{ fontFamily: 'monospace', fontSize: '0.82rem' }} />
                      </label>
                      <label className="crm-add-lead-field" style={{ gridColumn: '1 / -1' }}>
                        <span>Welcome Message</span>
                        <textarea value={waWelcomeMessage} onChange={(e) => setWaWelcomeMessage(e.target.value)} rows={2} placeholder="Hi! Thanks for reaching out." style={{ fontFamily: 'inherit', resize: 'vertical' }} />
                      </label>
                    </div>
                    <div style={{ marginTop: '12px', padding: '12px 16px', background: waCoexEnabled ? 'rgba(59,130,246,0.06)' : 'var(--bg-light)', borderRadius: '8px', border: `1px solid ${waCoexEnabled ? 'rgba(59,130,246,0.2)' : 'var(--border-subtle)'}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          <Smartphone size={16} style={{ color: waCoexEnabled ? '#2563EB' : 'var(--text-muted)' }} />
                          <div>
                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>WhatsApp App Sync (Coexistence)</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-dark)', marginTop: '2px' }}>Use the WhatsApp Business App and CRM API on the same number simultaneously</div>
                          </div>
                        </div>
                        <button type="button" onClick={() => setWaCoexEnabled(!waCoexEnabled)} style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', background: waCoexEnabled ? '#2563EB' : 'var(--border-subtle)', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
                          <span style={{ position: 'absolute', top: '2px', left: waCoexEnabled ? '22px' : '2px', width: '20px', height: '20px', borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                        </button>
                      </div>
                      {waCoexEnabled && (
                        <div style={{ marginTop: '10px', padding: '10px 12px', background: 'rgba(234,179,8,0.08)', borderRadius: '6px', border: '1px solid rgba(234,179,8,0.2)', fontSize: '0.74rem', color: '#a16207', lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
                          <span>Conversations started from the phone app cannot be replied to from the CRM (and vice versa). Enable this only if your team uses the WhatsApp Business App alongside the CRM on the same number. You must also enable CoEx in Meta Business Manager for this number.</span>
                        </div>
                      )}
                    </div>
                    <div style={{ marginTop: '14px', display: 'flex', gap: '8px' }}>
                      <button type="button" onClick={handleSaveWaNumber} disabled={waNumSaving} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 20px', border: 'none', borderRadius: '8px', background: waNumSaving ? '#94a3b8' : '#25D366', color: 'var(--bg-card)', fontSize: '0.82rem', fontWeight: 600, cursor: waNumSaving ? 'not-allowed' : 'pointer' }}>
                        {waNumSaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                        {waNumSaving ? 'Saving...' : editingWaNumberId ? 'Update Number' : 'Add Number'}
                      </button>
                      {(editingWaNumberId || waPhoneNumberId.trim() || waAccessToken.trim()) && (
                        <button type="button" onClick={resetWaForm} style={{ padding: '8px 16px', border: '1px solid var(--border-subtle)', borderRadius: '8px', background: 'var(--bg-card)', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>Clear</button>
                      )}
                    </div>
                  </div>
                  )}

                  {/* Phone Number Status & Quality Rating — only for first number */}
                  {waNumbersList.length > 0 && waNumbersList[0]?.phone_number_id && waNumbersList[0]?.access_token && (
                    <div style={{ marginBottom: '16px', padding: '16px', background: 'var(--bg-light)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Signal size={16} style={{ color: '#25D366' }} />
                          <strong style={{ fontSize: '0.85rem' }}>Phone Number Status</strong>
                        </div>
                        <button
                          type="button"
                          onClick={refreshWaStatus}
                          disabled={waStatusLoading}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', border: '1px solid var(--border-subtle)', borderRadius: '6px', background: 'var(--bg-card)', color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600, cursor: waStatusLoading ? 'not-allowed' : 'pointer', opacity: waStatusLoading ? 0.5 : 1 }}
                        >
                          {waStatusLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                          {waStatusLoading ? 'Checking...' : 'Refresh'}
                        </button>
                      </div>

                      {waStatusError && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', color: '#dc2626', fontSize: '0.78rem', marginBottom: '12px' }}>
                          <AlertTriangle size={14} /> {waStatusError}
                        </div>
                      )}

                      {waPhoneStatus && !waStatusError && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
                          {/* Connection Status */}
                          <div style={{ padding: '10px 12px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                            <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-dark)', marginBottom: '4px' }}>Connection Status</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {waPhoneStatus.status === 'CONNECTED' ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 700, color: '#16a34a' }}>
                                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} /> Connected
                                </span>
                              ) : waPhoneStatus.status === 'DISCONNECTED' ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 700, color: '#dc2626' }}>
                                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} /> Disconnected
                                </span>
                              ) : (
                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-dark)' }}>{waPhoneStatus.status || 'Unknown'}</span>
                              )}
                            </div>
                          </div>

                          {/* Quality Rating */}
                          <div style={{ padding: '10px 12px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                            <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-dark)', marginBottom: '4px' }}>Quality Rating</div>
                            {(() => {
                              const q = (waPhoneStatus.quality_rating || '').toUpperCase();
                              const colors: Record<string, { bg: string; text: string; label: string }> = {
                                GREEN: { bg: 'rgba(34,197,94,0.12)', text: '#15803d', label: 'High' },
                                YELLOW: { bg: 'rgba(234,179,8,0.12)', text: '#a16207', label: 'Medium' },
                                RED: { bg: 'rgba(239,68,68,0.12)', text: '#b91c1c', label: 'Low' },
                                UNKNOWN: { bg: 'rgba(100,116,139,0.12)', text: 'var(--text-muted)', label: 'Unknown' },
                              };
                              const c = colors[q] || { bg: 'rgba(100,116,139,0.12)', text: 'var(--text-muted)', label: waPhoneStatus.quality_rating || 'Unknown' };
                              return (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '4px', background: c.bg, color: c.text, fontSize: '0.78rem', fontWeight: 700 }}>
                                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: c.text, display: 'inline-block' }} /> {c.label}
                                </span>
                              );
                            })()}
                          </div>

                          {/* Name Status */}
                          <div style={{ padding: '10px 12px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                            <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-dark)', marginBottom: '4px' }}>Display Name</div>
                            {(() => {
                              const ns = (waPhoneStatus.name_status || '').toUpperCase();
                              const colors: Record<string, { bg: string; text: string }> = {
                                APPROVED: { bg: 'rgba(34,197,94,0.12)', text: '#15803d' },
                                REVIEW_PENDING: { bg: 'rgba(234,179,8,0.12)', text: '#a16207' },
                                REJECTED: { bg: 'rgba(239,68,68,0.12)', text: '#b91c1c' },
                              };
                              const c = colors[ns] || { bg: 'rgba(100,116,139,0.12)', text: 'var(--text-muted)' };
                              return (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '4px', background: c.bg, color: c.text, fontSize: '0.72rem', fontWeight: 700 }}>
                                  {waPhoneStatus.verified_name || 'Not set'} {waPhoneStatus.name_status && waPhoneStatus.name_status !== 'APPROVED' && `(${waPhoneStatus.name_status.replace(/_/g, ' ').toLowerCase()})`}
                                </span>
                              );
                            })()}
                          </div>

                          {/* Phone Number */}
                          {waPhoneStatus.display_phone_number && (
                            <div style={{ padding: '10px 12px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                              <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-dark)', marginBottom: '4px' }}>Phone Number</div>
                              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', fontFamily: 'monospace' }}>{waPhoneStatus.display_phone_number}</span>
                            </div>
                          )}

                          {/* Throughput Level */}
                          {waPhoneStatus.throughput?.level && (
                            <div style={{ padding: '10px 12px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                              <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-dark)', marginBottom: '4px' }}>Throughput</div>
                              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>{waPhoneStatus.throughput.level}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {!waPhoneStatus && !waStatusError && !waStatusLoading && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-dark)', padding: '4px 0' }}>Click "Refresh" to check your number status.</div>
                      )}
                    </div>
                  )}

                  {/* Display Name Editor — only for first number */}
                  {waNumbersList.length > 0 && waNumbersList[0]?.phone_number_id && waNumbersList[0]?.access_token && (
                    <div style={{ marginBottom: '16px', padding: '16px', background: 'var(--bg-light)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <Edit3 size={16} style={{ color: '#25D366' }} />
                        <strong style={{ fontSize: '0.85rem' }}>WhatsApp Display Name</strong>
                      </div>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-dark)', marginBottom: '12px', lineHeight: 1.5 }}>
                        This is the name shown to customers on WhatsApp. After submitting, Meta reviews the new name (usually within a few hours). You'll need to re-register your number in Meta Business Manager once the name is approved.
                      </p>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        <input
                          type="text"
                          value={waDisplayName}
                          onChange={(e) => { setWaDisplayName(e.target.value); setWaDisplayNameError(''); setWaDisplayNameSuccess(false); }}
                          placeholder="e.g. LeadCentre Trading"
                          style={{ flex: 1, minWidth: '200px', padding: '8px 12px', border: '1px solid var(--border-subtle)', borderRadius: '8px', fontSize: '0.82rem', fontFamily: 'inherit', background: 'var(--bg-card)' }}
                        />
                        <button
                          type="button"
                          disabled={waDisplayNameSaving || !waDisplayName.trim()}
                          onClick={async () => {
                            setWaDisplayNameSaving(true);
                            setWaDisplayNameError('');
                            setWaDisplayNameSuccess(false);
                            try {
                              const { data: sessionData } = await supabase.auth.getSession();
                              const token = sessionData.session?.access_token;
                              if (!token) { setWaDisplayNameError('Not authenticated'); setWaDisplayNameSaving(false); return; }
                              const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-profile-picture?action=rename`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                body: JSON.stringify({ new_display_name: waDisplayName.trim() }),
                              });
                              const data = await res.json();
                              if (!res.ok || data.error) {
                                setWaDisplayNameError(data.error || 'Failed to update name');
                              } else {
                                setWaDisplayNameSuccess(true);
                                refreshWaStatus();
                                setTimeout(() => setWaDisplayNameSuccess(false), 4000);
                              }
                            } catch {
                              setWaDisplayNameError('Failed to update name');
                            }
                            setWaDisplayNameSaving(false);
                          }}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', border: 'none', borderRadius: '8px', background: waDisplayNameSaving ? '#94a3b8' : '#25D366', color: 'var(--bg-card)', fontSize: '0.82rem', fontWeight: 600, cursor: waDisplayNameSaving ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
                        >
                          {waDisplayNameSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                          {waDisplayNameSaving ? 'Submitting...' : 'Update Name'}
                        </button>
                      </div>
                      {waDisplayNameSuccess && (
                        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#16a34a' }}>
                          <CheckCircle2 size={14} /> Name submitted. Meta will review it — check the status above after a few hours.
                        </div>
                      )}
                      {waDisplayNameError && (
                        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#ef4444' }}>
                          <AlertTriangle size={14} /> {waDisplayNameError}
                        </div>
                      )}
                      {waPhoneStatus?.name_status && waPhoneStatus.name_status !== 'APPROVED' && (
                        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#a16207', padding: '6px 10px', background: 'rgba(234,179,8,0.08)', borderRadius: '6px' }}>
                          <AlertTriangle size={12} /> Current name status: {waPhoneStatus.name_status.replace(/_/g, ' ').toLowerCase()}. After Meta approves the new name, re-register your number below or in Meta Business Manager.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Re-register Number — required after display name approval */}
                  {waNumbersList.length > 0 && waNumbersList[0]?.phone_number_id && waNumbersList[0]?.access_token && (
                    <div style={{ marginBottom: '16px', padding: '16px', background: 'var(--bg-light)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <RefreshCw size={16} style={{ color: '#25D366' }} />
                        <strong style={{ fontSize: '0.85rem' }}>Re-register Number (After Display Name Approval)</strong>
                      </div>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-dark)', marginBottom: '12px', lineHeight: 1.5 }}>
                        When Meta approves your display name, you must re-register your phone number for the change to take effect. Click "Send Code" to receive a verification code via SMS or voice call, then enter it to complete re-registration.
                      </p>
                      {waRegStep === 'idle' && (
                        <button
                          type="button"
                          disabled={waRegLoading}
                          onClick={async () => {
                            setWaRegLoading(true);
                            setWaRegError('');
                            try {
                              const { data: sessionData } = await supabase.auth.getSession();
                              const token = sessionData.session?.access_token;
                              if (!token) { setWaRegError('Not authenticated'); setWaRegLoading(false); return; }
                              const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-profile-picture?action=register`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                body: JSON.stringify({}),
                              });
                              const data = await res.json();
                              if (!res.ok || data.error) {
                                setWaRegError(data.error || 'Failed to send code');
                              } else {
                                setWaRegStep('code_sent');
                              }
                            } catch { setWaRegError('Failed to send code'); }
                            setWaRegLoading(false);
                          }}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', border: 'none', borderRadius: '8px', background: waRegLoading ? '#94a3b8' : '#25D366', color: 'var(--bg-card)', fontSize: '0.82rem', fontWeight: 600, cursor: waRegLoading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
                        >
                          {waRegLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                          {waRegLoading ? 'Sending...' : 'Send Code'}
                        </button>
                      )}
                      {waRegStep === 'code_sent' && (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                          <input
                            type="text"
                            value={waRegCode}
                            onChange={(e) => { setWaRegCode(e.target.value); setWaRegError(''); }}
                            placeholder="Enter 6-digit code"
                            style={{ flex: 1, minWidth: '160px', padding: '8px 12px', border: '1px solid var(--border-subtle)', borderRadius: '8px', fontSize: '0.82rem', fontFamily: 'monospace', background: 'var(--bg-card)' }}
                          />
                          <button
                            type="button"
                            disabled={waRegLoading || !waRegCode.trim()}
                            onClick={async () => {
                              setWaRegLoading(true);
                              setWaRegError('');
                              try {
                                const { data: sessionData } = await supabase.auth.getSession();
                                const token = sessionData.session?.access_token;
                                if (!token) { setWaRegError('Not authenticated'); setWaRegLoading(false); return; }
                                const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-profile-picture?action=register`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                  body: JSON.stringify({ code: waRegCode.trim() }),
                                });
                                const data = await res.json();
                                if (!res.ok || data.error) {
                                  setWaRegError(data.error || 'Failed to verify code');
                                } else {
                                  setWaRegSuccess(true);
                                  setWaRegStep('idle');
                                  setWaRegCode('');
                                  refreshWaStatus();
                                  setTimeout(() => setWaRegSuccess(false), 5000);
                                }
                              } catch { setWaRegError('Failed to verify code'); }
                              setWaRegLoading(false);
                            }}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', border: 'none', borderRadius: '8px', background: waRegLoading ? '#94a3b8' : '#25D366', color: 'var(--bg-card)', fontSize: '0.82rem', fontWeight: 600, cursor: waRegLoading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
                          >
                            {waRegLoading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                            {waRegLoading ? 'Verifying...' : 'Verify Code'}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setWaRegStep('idle'); setWaRegCode(''); setWaRegError(''); }}
                            style={{ padding: '8px 12px', border: '1px solid var(--border-subtle)', borderRadius: '8px', background: 'var(--bg-card)', color: 'var(--text-dark)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                      {waRegSuccess && (
                        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#16a34a' }}>
                          <CheckCircle2 size={14} /> Number re-registered successfully. You can now send WhatsApp messages.
                        </div>
                      )}
                      {waRegError && (
                        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#ef4444' }}>
                          <AlertTriangle size={14} /> {waRegError}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Profile Picture — for primary number */}
                  <div style={{ marginTop: '16px', padding: '16px', background: 'var(--bg-light)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Camera size={16} style={{ color: '#25D366' }} />
                      <strong style={{ fontSize: '0.85rem' }}>WhatsApp Profile Picture (Primary Number)</strong>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-dark)', marginBottom: '14px', lineHeight: 1.5 }}>
                      Upload a profile picture for your primary WhatsApp Business number. The image will be visible to customers who view your profile. Recommended size: 640x640 pixels.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                      <div style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--border-subtle)', background: 'var(--bg-card)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {waProfilePicUrl ? (
                          <img src={waProfilePicUrl} alt="WhatsApp profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <PhoneIcon size={28} style={{ color: 'var(--text-dark)' }} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: '200px' }}>
                        <input
                          ref={waProfilePicInputRef}
                          type="file"
                          accept="image/png,image/jpeg"
                          style={{ display: 'none' }}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > 5 * 1024 * 1024) {
                              setWaProfilePicError('Image must be under 5 MB');
                              return;
                            }
                            setWaProfilePicUploading(true);
                            setWaProfilePicError('');
                            setWaProfilePicSuccess(false);
                            try {
                              const reader = new FileReader();
                              reader.onload = async () => {
                                const base64 = (reader.result as string).split(',')[1];
                                const { data: sessionData } = await supabase.auth.getSession();
                                const token = sessionData.session?.access_token;
                                if (!token) { setWaProfilePicError('Not authenticated'); setWaProfilePicUploading(false); return; }
                                const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-profile-picture?action=upload`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                  body: JSON.stringify({ base64, mimeType: file.type, fileSize: file.size }),
                                });
                                const data = await res.json();
                                if (!res.ok || data.error) {
                                  setWaProfilePicError(data.error || 'Upload failed');
                                } else {
                                  setWaProfilePicSuccess(true);
                                  setTimeout(() => setWaProfilePicSuccess(false), 3000);
                                  try {
                                    const picRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-profile-picture?action=get`, { headers: { Authorization: `Bearer ${token}` } });
                                    if (picRes.ok) { const picData = await picRes.json(); setWaProfilePicUrl(picData.profile_picture_url || null); }
                                  } catch { /* non-fatal */ }
                                }
                                setWaProfilePicUploading(false);
                                if (waProfilePicInputRef.current) waProfilePicInputRef.current.value = '';
                              };
                              reader.readAsDataURL(file);
                            } catch {
                              setWaProfilePicError('Failed to read file');
                              setWaProfilePicUploading(false);
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => waProfilePicInputRef.current?.click()}
                          disabled={waProfilePicUploading || waNumbersList.length === 0}
                          style={{ padding: '8px 16px', border: 'none', borderRadius: '8px', background: waProfilePicUploading ? '#94a3b8' : '#25D366', color: 'var(--bg-card)', fontSize: '0.82rem', fontWeight: 600, cursor: waProfilePicUploading ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                        >
                          {waProfilePicUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                          {waProfilePicUploading ? 'Uploading...' : 'Upload Picture'}
                        </button>
                        {waProfilePicSuccess && (
                          <span style={{ marginLeft: '10px', fontSize: '0.78rem', color: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={14} /> Updated successfully
                          </span>
                        )}
                        {waProfilePicError && (
                          <span style={{ marginLeft: '10px', fontSize: '0.78rem', color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <AlertTriangle size={14} /> {waProfilePicError}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Webhook Setup */}
                  <div style={{ marginTop: '16px', padding: '16px', background: 'var(--bg-light)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Link2 size={16} style={{ color: '#25D366' }} />
                      <strong style={{ fontSize: '0.85rem' }}>Webhook Setup</strong>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-dark)', marginBottom: '12px', lineHeight: 1.5 }}>
                      After saving, go to Meta Business Manager &gt; WhatsApp &gt; Configuration and add this Callback URL with the Verify Token above.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                      <input
                        type="text"
                        readOnly
                        value={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`}
                        style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.78rem', fontFamily: 'monospace', background: 'var(--bg-card)', color: 'var(--text-muted)' }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`);
                          setWaWebhookCopied(true);
                          setTimeout(() => setWaWebhookCopied(false), 2000);
                        }}
                        style={{ padding: '8px 14px', border: 'none', borderRadius: '6px', background: '#25D366', color: 'var(--bg-card)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                      >
                        {waWebhookCopied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                        {waWebhookCopied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    {/* Verify Token copy row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>Verify Token</span>
                        <input
                          type="text"
                          readOnly
                          value={waVerifyToken || 'Save settings to generate a token'}
                          style={{ padding: '8px 12px', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.78rem', fontFamily: 'monospace', background: 'var(--bg-card)', color: waVerifyToken ? 'var(--text-muted)' : 'var(--text-dark)' }}
                        />
                      </div>
                      <button
                        type="button"
                        disabled={!waVerifyToken}
                        onClick={() => {
                          navigator.clipboard?.writeText(waVerifyToken);
                          setWaTokenCopied(true);
                          setTimeout(() => setWaTokenCopied(false), 2000);
                        }}
                        style={{ padding: '8px 14px', border: 'none', borderRadius: '6px', background: waVerifyToken ? '#25D366' : 'var(--border-subtle)', color: 'var(--bg-card)', fontSize: '0.78rem', fontWeight: 600, cursor: waVerifyToken ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', alignSelf: 'flex-end' }}
                      >
                        {waTokenCopied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                        {waTokenCopied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <div style={{ padding: '10px 14px', background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.25)', borderRadius: '8px', fontSize: '0.78rem', color: '#15803d', lineHeight: 1.5 }}>
                      <strong>Steps:</strong> 1. Save settings first. 2. Copy the Callback URL above. 3. Copy the Verify Token above. 4. In Meta, paste the Callback URL as the Webhook URL and paste the Verify Token into the Verify Token field. 5. Click Verify and Save. 6. Subscribe to the "messages" field.
                    </div>

                    {/* Webhook Verification Check */}
                    {waNumbersList.length > 0 && waNumbersList[0]?.phone_number_id && waNumbersList[0]?.access_token && waNumbersList[0]?.waba_id && (
                      <div style={{ marginTop: '12px', padding: '14px 16px', borderRadius: '10px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Activity size={16} style={{ color: '#25D366' }} />
                            <strong style={{ fontSize: '0.82rem' }}>Webhook Status</strong>
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={checkWaWebhook}
                              disabled={waWebhookChecking}
                              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', border: '1px solid var(--border-subtle)', borderRadius: '6px', background: 'var(--bg-card)', color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600, cursor: waWebhookChecking ? 'not-allowed' : 'pointer', opacity: waWebhookChecking ? 0.5 : 1 }}
                            >
                              {waWebhookChecking ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                              {waWebhookChecking ? 'Checking...' : 'Check Status'}
                            </button>
                            {waWebhookStatus && !waWebhookStatus.webhook_registered && waWebhookStatus.can_check && (
                              <button
                                type="button"
                                onClick={registerWaWebhook}
                                disabled={waWebhookRegistering}
                                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', border: 'none', borderRadius: '6px', background: '#25D366', color: 'var(--bg-card)', fontSize: '0.72rem', fontWeight: 600, cursor: waWebhookRegistering ? 'not-allowed' : 'pointer', opacity: waWebhookRegistering ? 0.5 : 1 }}
                              >
                                {waWebhookRegistering ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                                {waWebhookRegistering ? 'Registering...' : 'Re-register Webhook'}
                              </button>
                            )}
                          </div>
                        </div>

                        {waWebhookError && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', color: '#dc2626', fontSize: '0.76rem', marginBottom: '8px' }}>
                            <AlertTriangle size={14} /> {waWebhookError}
                          </div>
                        )}
                        {waWebhookSuccess && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '6px', color: '#15803d', fontSize: '0.76rem', marginBottom: '8px' }}>
                            <CheckCircle2 size={14} /> Webhook registered successfully!
                          </div>
                        )}
                        {waWebhookStatus && !waWebhookError && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem' }}>
                            {waWebhookStatus.webhook_registered ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#16a34a', fontWeight: 600 }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
                                Webhook Active
                              </span>
                            ) : (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#dc2626', fontWeight: 600 }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} />
                                Webhook Not Registered
                              </span>
                            )}
                            <span style={{ color: 'var(--text-dark)', fontSize: '0.74rem' }}>
                              {waWebhookStatus.message}
                            </span>
                          </div>
                        )}
                        {!waWebhookStatus && !waWebhookError && !waWebhookChecking && (
                          <div style={{ fontSize: '0.76rem', color: 'var(--text-dark)' }}>Click "Check Status" to verify your webhook is registered with Meta.</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Setup documentation */}
                  <details style={{ marginTop: '20px', border: '1px solid var(--border-subtle)', borderRadius: '10px', background: 'var(--bg-light)', overflow: 'hidden' }}>
                    <summary style={{ padding: '14px 16px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', listStyle: 'none', userSelect: 'none' }}>
                      <BookOpen size={18} style={{ color: '#25D366' }} />
                      Complete Setup Guide: How to configure the WhatsApp Business API
                      <ChevronDown size={16} style={{ marginLeft: 'auto', color: 'var(--text-dark)', transition: 'transform 0.2s' }} />
                    </summary>
                    <div style={{ padding: '0 16px 16px', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>

                      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', margin: '16px 0 8px' }}>What is the WhatsApp Business API?</h4>
                      <p style={{ margin: '0 0 12px' }}>
                        The WhatsApp Business API lets your CRM send and receive WhatsApp messages programmatically. Customers can message your business WhatsApp number, and their conversations appear in the WhatsApp Inbox tab — you can reply directly from the CRM just like a chat app.
                      </p>

                      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', margin: '16px 0 8px' }}>Prerequisites</h4>
                      <ul style={{ margin: '0 0 12px', paddingLeft: '20px' }}>
                        <li>A <strong>Meta Business Manager</strong> account (free at <span style={{ fontFamily: 'monospace' }}>business.facebook.com</span>).</li>
                        <li>A verified Meta Business account (complete the verification process in Business Manager settings).</li>
                        <li>A phone number that is <strong>not</strong> already registered with WhatsApp or WhatsApp Business app (new number required).</li>
                        <li>Admin or Developer access to the Business Manager.</li>
                      </ul>

                      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', margin: '16px 0 8px' }}>Step 1 — Create a Meta App with WhatsApp</h4>
                      <ol style={{ margin: '0 0 12px', paddingLeft: '20px' }}>
                        <li>Go to <strong>Meta Business Manager</strong> &rarr; <strong>Apps</strong> &rarr; <strong>Create App</strong>.</li>
                        <li>Choose <strong>Business</strong> as the app type and give it a name (e.g., "LeadCentre WhatsApp").</li>
                        <li>Once created, scroll to <strong>Add Products</strong> and select <strong>WhatsApp</strong>.</li>
                        <li>You'll see a test phone number, Phone Number ID, and a temporary access token — note these down.</li>
                      </ol>

                      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', margin: '16px 0 8px' }}>Step 2 — Add a permanent phone number</h4>
                      <ol style={{ margin: '0 0 12px', paddingLeft: '20px' }}>
                        <li>In Meta Business Manager, go to <strong>WhatsApp Manager</strong> &rarr; <strong>Phone Numbers</strong>.</li>
                        <li>Click <strong>Add Phone Number</strong> and follow the setup wizard.</li>
                        <li>Enter your new business phone number (must not be active on any other WhatsApp account).</li>
                        <li>Verify the number via SMS or voice call.</li>
                        <li>Once added, copy the <strong>Phone Number ID</strong> — a long number like <span style={{ fontFamily: 'monospace' }}>123456789012345</span>.</li>
                        <li>Paste it into the <strong>Phone Number ID</strong> field above.</li>
                      </ol>

                      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', margin: '16px 0 8px' }}>Step 3 — Generate a permanent Access Token</h4>
                      <ol style={{ margin: '0 0 12px', paddingLeft: '20px' }}>
                        <li>In Meta Business Manager, go to <strong>Business Settings</strong> &rarr; <strong>Users</strong> &rarr; <strong>System Users</strong>.</li>
                        <li>Click <strong>Add</strong> to create a System User (name it e.g., "CRM Integration").</li>
                        <li>Set the role to <strong>Admin</strong> (or assign the WhatsApp Business Account with appropriate permissions).</li>
                        <li>Click <strong>Generate New Token</strong> for this System User.</li>
                        <li>Select your WhatsApp App and choose the <strong>whatsapp_business_messaging</strong> and <strong>whatsapp_business_management</strong> permissions.</li>
                        <li>Click <strong>Generate Access Token</strong>. A long string starting with <span style={{ fontFamily: 'monospace' }}>EAA...</span> will appear.</li>
                        <li><strong>Copy this token immediately</strong> — Meta only shows it once. Store it securely.</li>
                        <li>Paste it into the <strong>Access Token</strong> field above.</li>
                      </ol>

                      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', margin: '16px 0 8px' }}>Step 4 — Find your WhatsApp Business Account ID</h4>
                      <p style={{ margin: '0 0 12px' }}>
                        The WhatsApp Business Account ID (WABA ID) is optional but recommended. Find it in Meta Business Manager under <strong>WhatsApp Manager</strong> &rarr; <strong>Account Details</strong>. It's a numeric ID that identifies your WhatsApp Business account. Paste it into the <strong>WhatsApp Business Account ID</strong> field above.
                      </p>

                      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', margin: '16px 0 8px' }}>Step 5 — Set up the Webhook</h4>
                      <p style={{ margin: '0 0 8px' }}>
                        The webhook is what lets Meta forward incoming WhatsApp messages to your CRM. Follow these steps:
                      </p>
                      <ol style={{ margin: '0 0 12px', paddingLeft: '20px' }}>
                        <li>First, click <strong>Save Settings</strong> at the bottom of this page to save your WhatsApp configuration.</li>
                        <li>Copy the <strong>Callback URL</strong> shown in the Webhook Setup box above.</li>
                        <li>Go to Meta Business Manager &rarr; <strong>WhatsApp Manager</strong> &rarr; <strong>Configuration</strong> (or your App's WhatsApp settings).</li>
                        <li>Find the <strong>Webhook</strong> section and click <strong>Edit</strong> or <strong>Configure</strong>.</li>
                        <li>Paste the Callback URL into the <strong>Callback URL</strong> field.</li>
                        <li>Enter your <strong>Verify Token</strong> (from the field above — if left blank, one was auto-generated when you saved; check the field value).</li>
                        <li>Click <strong>Verify and Save</strong>. Meta will send a verification request to confirm the URL is valid.</li>
                        <li>After verification, click <strong>Subscribe</strong> for the <strong>messages</strong> webhook field. This tells Meta to send incoming messages to your webhook.</li>
                      </ol>

                      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', margin: '16px 0 8px' }}>Step 6 — Add a test number (for development)</h4>
                      <p style={{ margin: '0 0 12px' }}>
                        Before your number is approved for production, you can only message <strong>test phone numbers</strong>. To add your own number as a test recipient:
                      </p>
                      <ol style={{ margin: '0 0 12px', paddingLeft: '20px' }}>
                        <li>Go to your WhatsApp App in Meta for Developers &rarr; <strong>WhatsApp</strong> &rarr; <strong>API Setup</strong>.</li>
                        <li>Under <strong>To</strong>, enter your personal phone number and click <strong>Add</strong>.</li>
                        <li>You'll receive a test message on WhatsApp. Reply to it, and it will appear in your CRM's WhatsApp Inbox.</li>
                        <li>Once your business number is verified and approved, you can message any number without adding them as a test recipient.</li>
                      </ol>

                      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', margin: '16px 0 8px' }}>Step 7 — Verify everything works</h4>
                      <ol style={{ margin: '0 0 12px', paddingLeft: '20px' }}>
                        <li>Make sure all fields above are filled and settings are saved.</li>
                        <li>Send a message (e.g., "hi") to your WhatsApp Business number from a test phone.</li>
                        <li>Open the <strong>WhatsApp Inbox</strong> tab in your CRM — the conversation should appear within a few seconds.</li>
                        <li>Type a reply in the CRM and send it — the message should arrive on the customer's WhatsApp.</li>
                      </ol>

                      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', margin: '16px 0 8px' }}>Troubleshooting</h4>
                      <ul style={{ margin: '0 0 12px', paddingLeft: '20px' }}>
                        <li><strong>Messages not arriving in CRM:</strong> Double-check the webhook is subscribed to the "messages" field in Meta. Verify the Callback URL and Verify Token match exactly.</li>
                        <li><strong>"Invalid token" error when sending replies:</strong> The access token may have expired. Regenerate it in System Users and update it here.</li>
                        <li><strong>"Phone number not registered" error:</strong> The number needs to be registered. Go to WhatsApp Manager &rarr; Phone Numbers and complete the registration process.</li>
                        <li><strong>Webhook verification fails:</strong> Make sure you saved settings first (the webhook endpoint needs your verify token to respond to Meta's challenge). Also ensure the Verify Token field matches what you entered in Meta.</li>
                        <li><strong>Can only message test numbers:</strong> Your number hasn't been approved for production yet. Submit it for review in WhatsApp Manager, or add recipient numbers as test contacts in the API Setup tab.</li>
                        <li><strong>Template message errors:</strong> Free-form messages can only be sent within 24 hours of the customer's last message. Outside that window, you need an approved message template.</li>
                      </ul>

                      <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(37,211,102,0.08)', borderRadius: '8px', border: '1px solid rgba(37,211,102,0.25)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        <strong>Tip:</strong> Keep your Access Token secure. Anyone with the token can send messages from your WhatsApp Business number. If you suspect it was leaked, regenerate it in Meta and update it here immediately.
                      </div>

                      <p style={{ marginTop: '12px', fontSize: '0.76rem', color: 'var(--text-dark)' }}>
                        Official Meta documentation: <span style={{ fontFamily: 'monospace' }}>developers.facebook.com/docs/whatsapp</span>
                      </p>
                    </div>
                  </details>

                  {/* Calling Setup Documentation */}
                  <details style={{ marginTop: '20px', border: '1px solid var(--border-subtle)', borderRadius: '10px', background: 'var(--bg-light)', overflow: 'hidden' }}>
                    <summary style={{ padding: '14px 16px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', listStyle: 'none', userSelect: 'none' }}>
                      <PhoneCall size={18} style={{ color: '#25D366' }} />
                      Complete Setup Guide: How to enable WhatsApp Calling (Voice Calls)
                      <ChevronDown size={16} style={{ marginLeft: 'auto', color: 'var(--text-dark)', transition: 'transform 0.2s' }} />
                    </summary>
                    <div style={{ padding: '0 16px 16px', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>

                      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', margin: '16px 0 8px' }}>What is WhatsApp Calling?</h4>
                      <p style={{ margin: '0 0 12px' }}>
                        WhatsApp Calling lets you place voice calls to your contacts through WhatsApp — directly from the CRM. The call uses WebRTC in your browser, so you talk through your computer's microphone and speakers. The contact receives the call on their WhatsApp app just like a normal WhatsApp voice call. You can also receive incoming calls.
                      </p>

                      <div style={{ padding: '10px 14px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: '8px', fontSize: '0.78rem', color: '#a16207', margin: '0 0 16px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div>
                          <strong>Important:</strong> WhatsApp Calling requires a <strong>payment method</strong> on your Meta WhatsApp Business Account. Without it, you will get a "Business eligibility payment issue for calling" error. See Step 4 below.
                        </div>
                      </div>

                      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', margin: '16px 0 8px' }}>Prerequisites</h4>
                      <ul style={{ margin: '0 0 12px', paddingLeft: '20px' }}>
                        <li>WhatsApp messaging must already be configured (complete the guide above first).</li>
                        <li>A <strong>credit card or bank account</strong> added to your Meta Business Manager billing.</li>
                        <li>Your business phone number must have calling enabled (Step 2 below).</li>
                        <li>Contacts must grant call permission before you can call them (Step 6 below).</li>
                        <li>A browser with microphone access (Chrome, Edge, or Firefox recommended).</li>
                      </ul>

                      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', margin: '16px 0 8px' }}>Step 1 — Verify messaging is working</h4>
                      <p style={{ margin: '0 0 12px' }}>
                        Before enabling calling, make sure WhatsApp messaging is already working: you can send and receive messages in the WhatsApp Inbox tab. Calling uses the same Phone Number ID and Access Token. If messaging isn't working yet, complete the messaging setup guide above first.
                      </p>

                      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', margin: '16px 0 8px' }}>Step 2 — Enable calling on your phone number</h4>
                      <p style={{ margin: '0 0 8px' }}>
                        Calling is <strong>not</strong> enabled by default. You must turn it on through the API or through this CRM.
                      </p>
                      <p style={{ margin: '0 0 8px', fontWeight: 600 }}>Option A — Through this CRM (easiest):</p>
                      <ol style={{ margin: '0 0 12px', paddingLeft: '20px' }}>
                        <li>Save your WhatsApp settings (Phone Number ID and Access Token) at the top of this page.</li>
                        <li>Open any WhatsApp conversation in the inbox.</li>
                        <li>Click the phone icon to start a call — the CRM will attempt to enable calling automatically if it's not yet enabled.</li>
                        <li>If calling is already enabled, the call will proceed normally.</li>
                      </ol>
                      <p style={{ margin: '0 0 8px', fontWeight: 600 }}>Option B — Through the Meta API directly:</p>
                      <p style={{ margin: '0 0 12px' }}>
                        Run this curl command, replacing <span style={{ fontFamily: 'monospace' }}>PHONE_NUMBER_ID</span> and <span style={{ fontFamily: 'monospace' }}>ACCESS_TOKEN</span> with your values:
                      </p>
                      <pre style={{ background: 'var(--text-main)', color: 'var(--border-subtle)', padding: '12px', borderRadius: '8px', fontSize: '0.74rem', overflowX: 'auto', margin: '0 0 12px', lineHeight: 1.5 }}>
{`curl -X POST \\
  "https://graph.facebook.com/v21.0/PHONE_NUMBER_ID/settings" \\
  -H "Authorization: Bearer ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "calling": {
      "status": "ENABLED",
      "call_icon_visibility": "DEFAULT",
      "callback_permission_status": "ENABLED",
      "call_hours": { "status": "DISABLED" }
    }
  }'`}
                      </pre>
                      <p style={{ margin: '0 0 12px' }}>
                        To verify calling is enabled, send a GET request to the same URL (without the -d flag) and check that <span style={{ fontFamily: 'monospace' }}>calling.status</span> is <span style={{ fontFamily: 'monospace' }}>"ENABLED"</span>.
                      </p>

                      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', margin: '16px 0 8px' }}>Step 3 — Subscribe the webhook to "calls" events</h4>
                      <p style={{ margin: '0 0 8px' }}>
                        Your webhook is already configured for messaging. You also need to subscribe it to call events so Meta can send ringing, accepted, rejected, and ended notifications back to your CRM.
                      </p>
                      <ol style={{ margin: '0 0 12px', paddingLeft: '20px' }}>
                        <li>Go to Meta Business Manager &rarr; your App &rarr; <strong>WhatsApp</strong> &rarr; <strong>Configuration</strong>.</li>
                        <li>Find the <strong>Webhook Fields</strong> section.</li>
                        <li>Click <strong>Manage</strong> or <strong>Edit</strong>.</li>
                        <li>Subscribe to the <strong>calls</strong> field (in addition to <strong>messages</strong> which should already be subscribed).</li>
                        <li>Click <strong>Save</strong>.</li>
                      </ol>
                      <div style={{ padding: '10px 14px', background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.25)', borderRadius: '8px', fontSize: '0.78rem', color: '#15803d', margin: '0 0 16px' }}>
                        <strong>Note:</strong> Your CRM uses two webhook endpoints. The messaging webhook is <span style={{ fontFamily: 'monospace' }}>/functions/v1/whatsapp-webhook</span> and the calling webhook is <span style={{ fontFamily: 'monospace' }}>/functions/v1/whatsapp-call-signaling</span>. Both are already deployed — you just need to subscribe to the right fields in Meta.
                      </div>

                      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', margin: '16px 0 8px' }}>Step 4 — Add a payment method (Required)</h4>
                      <p style={{ margin: '0 0 8px' }}>
                        This is the most commonly missed step. Meta requires a valid payment method on your WhatsApp Business Account before calls work. Without it, you'll get:
                      </p>
                      <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', fontSize: '0.78rem', color: '#dc2626', margin: '0 0 12px' }}>
                        <strong>Error:</strong> "Business eligibility payment issue for calling" (error code 131044)
                      </div>
                      <ol style={{ margin: '0 0 12px', paddingLeft: '20px' }}>
                        <li>Go to <strong>business.facebook.com</strong> &rarr; <strong>Business Settings</strong> &rarr; <strong>Billing</strong> &rarr; <strong>Payment methods</strong>.</li>
                        <li>Click <strong>Add payment method</strong> and enter your credit card or bank account details.</li>
                        <li>Go to <strong>WhatsApp Manager</strong> (<span style={{ fontFamily: 'monospace' }}>business.facebook.com/wa</span>).</li>
                        <li>Select your WhatsApp Business Account.</li>
                        <li>Go to <strong>Billing</strong> or <strong>Payment settings</strong> and confirm the payment method is linked to this WABA.</li>
                        <li>Wait up to <strong>24 hours</strong> for Meta to process the payment method.</li>
                      </ol>
                      <div style={{ padding: '10px 14px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: '8px', fontSize: '0.78rem', color: '#a16207', margin: '0 0 16px' }}>
                        <strong>Tip:</strong> If you still get the payment error after adding a card, wait 24 hours and try again. Meta's billing system needs time to activate.
                      </div>

                      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', margin: '16px 0 8px' }}>Step 5 — Configure the calling webhook URL</h4>
                      <p style={{ margin: '0 0 8px' }}>
                        The calling webhook is a separate endpoint from the messaging webhook. You need to register it in Meta:
                      </p>
                      <ol style={{ margin: '0 0 12px', paddingLeft: '20px' }}>
                        <li>Copy this URL: <span style={{ fontFamily: 'monospace', fontSize: '0.76rem', wordBreak: 'break-all' }}>{import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-call-signaling</span></li>
                        <li>In Meta Business Manager, go to your App &rarr; <strong>WhatsApp</strong> &rarr; <strong>Configuration</strong>.</li>
                        <li>If you already have a callback URL configured for messaging, you can use the same URL for calls — Meta routes call events to the same webhook based on the subscribed fields.</li>
                        <li>If setting up separately, paste the URL as the Callback URL and use the same Verify Token from your settings above.</li>
                        <li>Click <strong>Verify and Save</strong>.</li>
                        <li>Subscribe to the <strong>calls</strong> field (and keep <strong>messages</strong> subscribed for permission replies).</li>
                      </ol>

                      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', margin: '16px 0 8px' }}>Step 6 — Understand the call permission flow</h4>
                      <p style={{ margin: '0 0 8px' }}>
                        WhatsApp requires contacts to <strong>explicitly grant permission</strong> before a business can call them. This is a Meta privacy requirement. Here's how it works:
                      </p>
                      <ol style={{ margin: '0 0 12px', paddingLeft: '20px' }}>
                        <li><strong>You click the call button</strong> on a contact in the WhatsApp inbox.</li>
                        <li>The CRM checks if the contact has granted call permission via Meta's API.</li>
                        <li><strong>If permission is granted:</strong> The call proceeds — Meta rings the contact's WhatsApp app.</li>
                        <li><strong>If permission is NOT granted:</strong> The CRM automatically sends a permission request message to the contact: <em>"We would like to call you to provide support. Please grant permission so we can place a call to you."</em></li>
                        <li>The contact taps <strong>Allow</strong> in their WhatsApp app.</li>
                        <li>Meta sends a webhook to your CRM, storing the permission in the database.</li>
                        <li><strong>You click call again</strong> — this time the call goes through.</li>
                      </ol>
                      <div style={{ padding: '10px 14px', background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.25)', borderRadius: '8px', fontSize: '0.78rem', color: '#15803d', margin: '0 0 12px' }}>
                        <strong>Permission limits:</strong> You can send 1 permission request per contact per 24 hours, and 2 per 7 days. Total 100 calls per 24 hours across all contacts.
                      </div>
                      <p style={{ margin: '0 0 12px' }}>
                        Permission can be <strong>permanent</strong> (contact grants it once, you can call anytime) or <strong>temporary</strong> (expires after a set time). Contacts can revoke permission at any time through WhatsApp settings.
                      </p>

                      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', margin: '16px 0 8px' }}>Step 7 — Make your first call</h4>
                      <ol style={{ margin: '0 0 12px', paddingLeft: '20px' }}>
                        <li>Open the <strong>WhatsApp Inbox</strong> tab in your CRM.</li>
                        <li>Select a conversation with a contact.</li>
                        <li>Click the <strong>phone icon</strong> next to the contact's name.</li>
                        <li>Your browser will ask for microphone permission — click <strong>Allow</strong>.</li>
                        <li>If the contact hasn't granted call permission, the CRM sends a permission request. Wait for them to accept, then click call again.</li>
                        <li>If permission is granted, Meta rings the contact's WhatsApp. When they answer, you'll hear them through your speakers.</li>
                        <li>To end the call, click the <strong>End Call</strong> button.</li>
                      </ol>

                      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', margin: '16px 0 8px' }}>Step 8 — Receiving incoming calls</h4>
                      <p style={{ margin: '0 0 12px' }}>
                        When a contact calls your WhatsApp Business number, Meta sends a webhook event to your CRM. You'll see an incoming call notification in the WhatsApp inbox. Click <strong>Accept</strong> to answer (your browser will request microphone access) or <strong>Reject</strong> to decline.
                      </p>

                      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', margin: '16px 0 8px' }}>Step 9 — Recording and transcription (Optional)</h4>
                      <p style={{ margin: '0 0 12px' }}>
                        When initiating a call, the CRM can optionally enable recording and transcription. Meta plays an automated announcement to both parties indicating the call is being recorded. After the call ends, Meta sends a webhook with the recording and/or transcript. These are stored in your database and can be downloaded from the call logs.
                      </p>

                      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', margin: '16px 0 8px' }}>Troubleshooting — Calling</h4>
                      <ul style={{ margin: '0 0 12px', paddingLeft: '20px' }}>
                        <li><strong>"Business eligibility payment issue for calling" (error 131044):</strong> No payment method on your WABA. Add one in Meta Business Manager &rarr; Billing. Wait 24 hours.</li>
                        <li><strong>"Call failed" immediately:</strong> Check that calling is enabled on your phone number (Step 2), your access token is valid, and the phone number has no special characters.</li>
                        <li><strong>"Permission denied":</strong> The contact hasn't granted call permission. The CRM sends a request automatically — wait for them to accept, then call again.</li>
                        <li><strong>Webhook not receiving call events:</strong> Verify you subscribed to the "calls" field in Meta (Step 3). Check Edge Function logs in Supabase dashboard.</li>
                        <li><strong>Browser microphone not working:</strong> Click the lock icon in your browser address bar, allow microphone access, refresh the page.</li>
                        <li><strong>"User is not opted in":</strong> The contact hasn't messaged your business number in the last 24 hours. They need to send a message first, or you need to use a message template to re-open the window.</li>
                        <li><strong>Call rings but contact can't answer:</strong> The contact may not have WhatsApp calling enabled on their device, or their WhatsApp version is outdated.</li>
                      </ul>

                      <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(37,211,102,0.08)', borderRadius: '8px', border: '1px solid rgba(37,211,102,0.25)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        <strong>Tip:</strong> A full standalone copy of this guide is also saved as <span style={{ fontFamily: 'monospace' }}>docs/whatsapp-calling-setup.md</span> in your project files for reference.
                      </div>

                      <p style={{ marginTop: '12px', fontSize: '0.76rem', color: 'var(--text-dark)' }}>
                        Official Meta calling documentation: <span style={{ fontFamily: 'monospace' }}>developers.facebook.com/docs/whatsapp/whatsapp-calling</span>
                      </p>
                    </div>
                  </details>

                </>
              ) : activeTab === 'followup' ? (
                <>
                  <div className="crm-settings-card-header">
                    <h2 className="crm-settings-card-title"><Bell size={20} style={{ color: '#0891B2' }} /> Follow-Up Reminders</h2>
                    <p className="crm-settings-card-desc">Get email reminders to follow up with leads. When you schedule a follow-up from a lead's profile, an email alert will be sent to your personal email at the date and time you choose.</p>
                  </div>

                  <div style={{ background: 'rgba(8,145,178,0.06)', border: '1px solid rgba(8,145,178,0.2)', borderRadius: '10px', padding: '14px 16px', marginBottom: '16px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <BellRing size={18} style={{ color: '#0891B2', flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      <strong>How it works:</strong> Open any lead, click "Set Follow-up Reminder", pick a date and time. You'll get an email at that exact time with the lead's name and your notes.
                    </div>
                  </div>

                  <div className="crm-add-lead-field" style={{ marginBottom: '12px' }}>
                    <span>Reminder Email Addresses <em>*</em></span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {reminderEmails.map((email, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => {
                              const next = [...reminderEmails];
                              next[idx] = e.target.value;
                              setReminderEmails(next);
                            }}
                            placeholder="your.personal@gmail.com"
                            style={{ flex: 1 }}
                          />
                          {reminderEmails.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setReminderEmails(reminderEmails.filter((_, i) => i !== idx))}
                              style={{
                                flexShrink: 0, width: '36px', height: '36px', border: '1px solid var(--border-subtle)',
                                borderRadius: '8px', background: 'var(--bg-light)', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444',
                              }}
                              title="Remove"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setReminderEmails([...reminderEmails, ''])}
                        style={{
                          alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '6px',
                          padding: '6px 14px', border: '1px dashed #0891B2', borderRadius: '8px',
                          background: 'rgba(8,145,178,0.04)', color: '#0891B2', fontSize: '0.82rem',
                          fontWeight: 600, cursor: 'pointer', marginTop: '4px',
                        }}
                      >
                        <Plus size={15} /> Add another email
                      </button>
                    </div>
                    <small style={{ color: 'var(--text-dark)', fontSize: '0.74rem', marginTop: '4px', display: 'block' }}>
                      Follow-up reminder emails will be sent to all addresses listed above.
                    </small>
                  </div>

                  <label className="crm-add-lead-field" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px', marginTop: '12px' }}>
                    <input type="checkbox" checked={enableReminders} onChange={(e) => setEnableReminders(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#0891B2' }} />
                    <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>Enable follow-up email reminders</span>
                  </label>

                  <div style={{ marginTop: '20px', padding: '16px', background: enableChatNotifications ? 'rgba(8,145,178,0.06)' : 'var(--bg-light)', borderRadius: '10px', border: `1px solid ${enableChatNotifications ? 'rgba(8,145,178,0.2)' : 'var(--border-subtle)'}`, transition: 'all 0.2s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button
                        type="button"
                        onClick={() => setEnableChatNotifications(!enableChatNotifications)}
                        style={{
                          width: '44px', height: '24px', borderRadius: '12px', border: 'none',
                          background: enableChatNotifications ? '#0891B2' : 'var(--text-dark)',
                          position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background 0.2s',
                        }}
                      >
                        <span style={{
                          position: 'absolute', top: '2px', left: enableChatNotifications ? '22px' : '2px',
                          width: '20px', height: '20px', borderRadius: '50%', background: 'var(--bg-card)',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s',
                        }} />
                      </button>
                      <div>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>Chat message email notifications</span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-dark)', display: 'block' }}>Get an email when a team member sends a message in team chat</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '12px', padding: '16px', background: enableWhatsAppNotifications ? 'rgba(37,211,102,0.06)' : 'var(--bg-light)', borderRadius: '10px', border: `1px solid ${enableWhatsAppNotifications ? 'rgba(37,211,102,0.2)' : 'var(--border-subtle)'}`, transition: 'all 0.2s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button
                        type="button"
                        onClick={() => setEnableWhatsAppNotifications(!enableWhatsAppNotifications)}
                        style={{
                          width: '44px', height: '24px', borderRadius: '12px', border: 'none',
                          background: enableWhatsAppNotifications ? '#25D366' : 'var(--text-dark)',
                          position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background 0.2s',
                        }}
                      >
                        <span style={{
                          position: 'absolute', top: '2px', left: enableWhatsAppNotifications ? '22px' : '2px',
                          width: '20px', height: '20px', borderRadius: '50%', background: 'var(--bg-card)',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s',
                        }} />
                      </button>
                      <div>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>WhatsApp inbox email notifications</span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-dark)', display: 'block' }}>Get an email when a client sends a message on WhatsApp</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '12px', padding: '16px', background: enableTelegramNotifications ? 'rgba(0,136,204,0.06)' : 'var(--bg-light)', borderRadius: '10px', border: `1px solid ${enableTelegramNotifications ? 'rgba(0,136,204,0.2)' : 'var(--border-subtle)'}`, transition: 'all 0.2s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button
                        type="button"
                        onClick={() => setEnableTelegramNotifications(!enableTelegramNotifications)}
                        style={{
                          width: '44px', height: '24px', borderRadius: '12px', border: 'none',
                          background: enableTelegramNotifications ? '#0088cc' : 'var(--text-dark)',
                          position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background 0.2s',
                        }}
                      >
                        <span style={{
                          position: 'absolute', top: '2px', left: enableTelegramNotifications ? '22px' : '2px',
                          width: '20px', height: '20px', borderRadius: '50%', background: 'var(--bg-card)',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s',
                        }} />
                      </button>
                      <div>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>Telegram inbox email notifications</span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-dark)', display: 'block' }}>Get an email when a client sends a message on Telegram</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '20px', padding: '16px', background: enableAutoWelcomeEmail ? 'rgba(8,145,178,0.06)' : 'var(--bg-light)', borderRadius: '10px', border: `1px solid ${enableAutoWelcomeEmail ? 'rgba(8,145,178,0.2)' : 'var(--border-subtle)'}`, transition: 'all 0.2s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: enableAutoWelcomeEmail ? '14px' : '0' }}>
                      <button
                        type="button"
                        onClick={() => setEnableAutoWelcomeEmail(!enableAutoWelcomeEmail)}
                        style={{
                          width: '44px', height: '24px', borderRadius: '12px', border: 'none',
                          background: enableAutoWelcomeEmail ? '#0891B2' : 'var(--text-dark)',
                          position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background 0.2s',
                        }}
                      >
                        <span style={{
                          position: 'absolute', top: '2px', left: enableAutoWelcomeEmail ? '22px' : '2px',
                          width: '20px', height: '20px', borderRadius: '50%', background: 'var(--bg-card)',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s',
                        }} />
                      </button>
                      <div>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>Auto welcome email on new lead</span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-dark)', display: 'block' }}>Automatically send a welcome email when someone fills out your lead form</span>
                      </div>
                    </div>
                    {enableAutoWelcomeEmail && (
                      <div>
                        <label className="crm-add-lead-field" style={{ marginTop: '12px' }}>
                          <span>Email subject (optional)</span>
                          <input type="text" value={autoWelcomeEmailSubject} onChange={(e) => setAutoWelcomeEmailSubject(e.target.value)} placeholder="Welcome to {product}, {name}!" style={{ width: '100%' }} />
                          <small style={{ color: 'var(--text-dark)', fontSize: '0.74rem', marginTop: '4px', display: 'block' }}>Use {'{name}'}, {'{email}'}, {'{product}'}, {'{fund_amount}'}, {'{telegram_link}'}, {'{whatsapp_group_link}'} as placeholders.</small>
                        </label>
                        <label className="crm-add-lead-field" style={{ marginTop: '10px' }}>
                          <span>Email body (optional)</span>
                          <textarea value={autoWelcomeEmailBody} onChange={(e) => setAutoWelcomeEmailBody(e.target.value)} rows={5} placeholder="Hi {name}, thank you for your interest in our {product}! We will get in touch with you shortly." style={{ width: '100%', fontFamily: 'inherit', resize: 'vertical' }} />
                          <small style={{ color: 'var(--text-dark)', fontSize: '0.74rem', marginTop: '4px', display: 'block' }}>Leave blank to use a default welcome message.</small>
                        </label>

                        <div style={{ marginTop: '16px', padding: '12px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '10px' }}>Welcome Email Enhancements</div>

                          <label className="crm-add-lead-field" style={{ marginTop: '8px' }}>
                            <span>Urgency: Reply within (hours)</span>
                            <input type="number" min="1" max="168" value={welcomeUrgencyHours} onChange={(e) => setWelcomeUrgencyHours(Number(e.target.value) || 24)} placeholder="24" style={{ width: '100%' }} />
                            <small style={{ color: 'var(--text-dark)', fontSize: '0.74rem', marginTop: '4px', display: 'block' }}>Adds a line urging the lead to reply within this time. Set to 0 to disable.</small>
                          </label>

                          <label className="crm-add-lead-field" style={{ marginTop: '8px' }}>
                            <span>Next steps checklist (optional)</span>
                            <textarea value={welcomeNextSteps} onChange={(e) => setWelcomeNextSteps(e.target.value)} rows={4} placeholder="1. Join our Telegram group&#10;2. Reply with your MT5 account number&#10;3. Wait for our team to approve access" style={{ width: '100%', fontFamily: 'inherit', resize: 'vertical' }} />
                            <small style={{ color: 'var(--text-dark)', fontSize: '0.74rem', marginTop: '4px', display: 'block' }}>Shown as a numbered action plan. Use {'{telegram_link}'}, {'{whatsapp_group_link}'} as placeholders.</small>
                          </label>

                          <label className="crm-add-lead-field" style={{ marginTop: '8px' }}>
                            <span>Booking / Calendly link (optional)</span>
                            <input type="text" value={welcomeBookingLink} onChange={(e) => setWelcomeBookingLink(e.target.value)} placeholder="https://calendly.com/yourname/30min" style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.82rem' }} />
                            <small style={{ color: 'var(--text-dark)', fontSize: '0.74rem', marginTop: '4px', display: 'block' }}>Adds a "Book a Call" button so leads can schedule directly. Use {'{booking_link}'} in your email body.</small>
                          </label>

                          <label className="crm-add-lead-field" style={{ marginTop: '8px' }}>
                            <span>Testimonial / social proof (optional)</span>
                            <textarea value={welcomeTestimonial} onChange={(e) => setWelcomeTestimonial(e.target.value)} rows={3} placeholder="This algo changed my trading game. I went from consistent losses to 15% monthly returns." style={{ width: '100%', fontFamily: 'inherit', resize: 'vertical' }} />
                            <small style={{ color: 'var(--text-dark)', fontSize: '0.74rem', marginTop: '4px', display: 'block' }}>A short quote shown in a highlighted box to build credibility.</small>
                          </label>

                          <label className="crm-add-lead-field" style={{ marginTop: '8px' }}>
                            <span>Testimonial author (optional)</span>
                            <input type="text" value={welcomeTestimonialAuthor} onChange={(e) => setWelcomeTestimonialAuthor(e.target.value)} placeholder="Rajesh K., Verified Trader" style={{ width: '100%' }} />
                          </label>

                          <label className="crm-add-lead-field" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                            <input type="checkbox" checked={welcomeReplyTracking} onChange={(e) => setWelcomeReplyTracking(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#0891B2' }} />
                            <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Track email replies - add a note to the lead when they respond</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  {allFollowups.length > 0 && (
                    <div style={{ marginTop: '24px' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dark)', marginBottom: '12px' }}>
                        Upcoming & Recent Reminders ({allFollowups.length})
                      </div>
                      <div className="crm-reminder-list">
                        {allFollowups.slice(0, 15).map((f) => {
                          const rDate = new Date(f.reminder_at);
                          const isPast = f.status === 'sent' || (f.status === 'pending' && rDate.getTime() < Date.now());
                          const isSent = f.status === 'sent';
                          const isDone = f.status === 'done';
                          return (
                            <div key={f.id} className={`crm-reminder-item ${isPast && !isSent && !isDone ? 'crm-reminder-overdue' : ''} ${isDone ? 'crm-reminder-done' : ''}`}>
                              <div className="crm-reminder-icon-wrap">
                                {isSent ? <BellRing size={16} style={{ color: '#0891B2' }} /> :
                                 isDone ? <CheckCircle2 size={16} style={{ color: '#22c55e' }} /> :
                                 isPast ? <BellRing size={16} style={{ color: '#ef4444' }} /> :
                                 <Bell size={16} style={{ color: '#f59e0b' }} />}
                              </div>
                              <div className="crm-reminder-content">
                                <span className="crm-reminder-date">{new Date(f.reminder_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(f.reminder_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                                {f.note && <span className="crm-reminder-note">{f.note}</span>}
                                <span className={`crm-reminder-badge ${isPast && !isSent && !isDone ? 'crm-badge-overdue' : ''} ${isSent ? 'crm-badge-sent' : ''} ${isDone ? 'crm-badge-done' : ''}`}>
                                  {isSent ? 'Email sent' : isDone ? 'Done' : isPast ? 'Overdue - sending soon' : 'Pending'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {allFollowups.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-dark)' }}>
                      <Bell size={36} style={{ marginBottom: '10px', opacity: 0.3 }} />
                      <p style={{ fontSize: '0.85rem' }}>No reminders scheduled yet. Open a lead and click "Set Follow-up Reminder" to create one.</p>
                    </div>
                  )}
                </>
              ) : activeTab === 'scheduled_emails' ? (
                <ScheduledEmailsPanel session={session} />
              ) : activeTab === 'telegram' ? (
                <>
                  <div className="crm-settings-card-header">
                    <h2 className="crm-settings-card-title"><MessageCircle size={20} style={{ color: '#0088cc' }} /> Telegram Bots</h2>
                    <p className="crm-settings-card-desc">Connect multiple Telegram bots (e.g. Sales, Support, Community). Create each bot via <strong>@BotFather</strong> on Telegram to get its token. Each bot has its own conversations, welcome message, and webhook.</p>
                  </div>

                  {/* General Telegram settings (links shown on landing page / welcome emails) */}
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dark)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Link2 size={14} style={{ color: '#0088cc' }} /> Landing Page & Welcome Email Links
                    </div>
                    <div className="crm-add-lead-grid">
                      <label className="crm-add-lead-field" style={{ gridColumn: '1 / -1' }}>
                        <span>Telegram Community Link</span>
                        <input
                          type="text"
                          value={telegramLink}
                          onChange={(e) => setTelegramLink(e.target.value)}
                          placeholder="https://t.me/your_channel"
                          style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}
                        />
                        <small style={{ color: 'var(--text-dark)', fontSize: '0.74rem', marginTop: '4px', display: 'block' }}>
                          Appears as a "Join Telegram Community" button on your landing page after a visitor submits the form.
                        </small>
                      </label>
                      <label className="crm-add-lead-field" style={{ gridColumn: '1 / -1' }}>
                        <span>WhatsApp Group Link</span>
                        <input
                          type="text"
                          value={whatsappGroupLink}
                          onChange={(e) => setWhatsappGroupLink(e.target.value)}
                          placeholder="https://chat.whatsapp.com/your_group"
                          style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}
                        />
                        <small style={{ color: 'var(--text-dark)', fontSize: '0.74rem', marginTop: '4px', display: 'block' }}>
                          Included in the auto welcome email so leads can join your WhatsApp group.
                        </small>
                      </label>

                    </div>
                  </div>

                  {/* Connected Bots List */}
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Bot size={16} style={{ color: '#0088cc' }} /> Connected Bots ({tgBotsList.length})
                      </div>
                      {!editingTgBotId && (
                        <button
                          type="button"
                          onClick={() => { resetTgBotForm(); setEditingTgBotId(''); }}
                          style={{ padding: '7px 14px', border: '1px solid #0088cc', borderRadius: '8px', background: 'rgba(0,136,204,0.06)', color: '#0088cc', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#0088cc'; e.currentTarget.style.color = '#fff'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,136,204,0.06)'; e.currentTarget.style.color = '#0088cc'; }}
                        >
                          <Plus size={15} /> Add Bot
                        </button>
                      )}
                    </div>

                    {tgBotsList.length === 0 && !editingTgBotId && (
                      <div style={{ padding: '24px', background: 'var(--bg-light)', borderRadius: '10px', border: '1px dashed var(--border-subtle)', textAlign: 'center' }}>
                        <Bot size={32} style={{ color: 'var(--text-dark)', opacity: 0.3, marginBottom: '8px' }} />
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-dark)', margin: 0 }}>No bots connected yet. Click "Add Bot" to connect your first Telegram bot.</p>
                      </div>
                    )}

                    {tgBotsList.map((bot) => {
                      const ws = tgWebhookStatuses[bot.id] || 'idle';
                      const hookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-webhook/${bot.webhook_secret}`;
                      return (
                        <div key={bot.id} style={{ padding: '16px', background: 'var(--bg-light)', borderRadius: '10px', border: '1px solid var(--border-subtle)', marginBottom: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: '200px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>{bot.label}</span>
                                {bot.bot_username && <span style={{ fontSize: '0.78rem', color: '#0088cc', fontWeight: 600 }}>@{bot.bot_username}</span>}
                                <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '6px', fontWeight: 600, background: bot.is_active ? 'rgba(22,163,74,0.1)' : 'rgba(239,68,68,0.1)', color: bot.is_active ? '#16a34a' : '#dc2626' }}>
                                  {bot.is_active ? 'Active' : 'Disabled'}
                                </span>
                              </div>
                              {bot.welcome_message && <p style={{ fontSize: '0.78rem', color: 'var(--text-dark)', margin: '0 0 8px' }}>Welcome: {bot.welcome_message.slice(0, 60)}{bot.welcome_message.length > 60 ? '...' : ''}</p>}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                                <button
                                  type="button"
                                  onClick={() => handleSetupWebhook(bot.id, bot.bot_token, bot.webhook_secret)}
                                  disabled={ws === 'setting'}
                                  style={{ padding: '6px 12px', border: 'none', borderRadius: '6px', background: ws === 'set' ? 'rgba(22,163,74,0.1)' : '#0088cc', color: ws === 'set' ? '#16a34a' : '#fff', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                                >
                                  {ws === 'setting' ? <Loader2 size={12} className="crm-spin" /> : ws === 'set' ? <CheckCircle2 size={12} /> : <Link2 size={12} />}
                                  {ws === 'setting' ? 'Connecting...' : ws === 'set' ? 'Webhook Active' : ws === 'error' ? 'Retry Webhook' : 'Connect Webhook'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { navigator.clipboard.writeText(hookUrl); setTgWebhookCopied(bot.id); setTimeout(() => setTgWebhookCopied(null), 2000); }}
                                  style={{ padding: '6px 10px', border: '1px solid var(--border-subtle)', borderRadius: '6px', background: 'var(--bg-card)', color: 'var(--text-dark)', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                  {tgWebhookCopied === bot.id ? <CheckCircle2 size={12} style={{ color: '#16a34a' }} /> : <Copy size={12} />}
                                  {tgWebhookCopied === bot.id ? 'Copied!' : 'Webhook URL'}
                                </button>
                              </div>
                              {ws === 'error' && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '6px 0 0' }}>Failed to connect. Make sure the bot token is correct.</p>}
                            </div>
                            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                              <button type="button" onClick={() => handleToggleTgBot(bot)} style={{ padding: '6px 10px', border: '1px solid var(--border-subtle)', borderRadius: '6px', background: 'var(--bg-card)', color: bot.is_active ? '#dc2626' : '#16a34a', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>
                                {bot.is_active ? 'Disable' : 'Enable'}
                              </button>
                              <button type="button" onClick={() => startEditTgBot(bot)} style={{ padding: '6px 10px', border: '1px solid var(--border-subtle)', borderRadius: '6px', background: 'var(--bg-card)', color: 'var(--text-dark)', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Edit3 size={12} /> Edit
                              </button>
                              <button type="button" onClick={() => handleDeleteTgBot(bot.id)} disabled={deletingTgBotId === bot.id} style={{ padding: '6px 10px', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', background: 'rgba(239,68,68,0.06)', color: '#dc2626', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {deletingTgBotId === bot.id ? <Loader2 size={12} className="crm-spin" /> : <Trash2 size={12} />} Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Add/Edit Bot Form */}
                    {editingTgBotId !== null && (
                      <div style={{ padding: '20px', background: 'var(--bg-card)', borderRadius: '10px', border: '1px solid #0088cc', marginTop: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>{editingTgBotId ? 'Edit Bot' : 'Add New Bot'}</span>
                          <button type="button" onClick={resetTgBotForm} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-dark)', padding: '4px' }}>
                            <X size={18} />
                          </button>
                        </div>
                        <div className="crm-add-lead-grid">
                          <label className="crm-add-lead-field">
                            <span>Bot Label</span>
                            <input type="text" value={tgBotLabel} onChange={(e) => setTgBotLabel(e.target.value)} placeholder="Sales Bot" />
                            <small style={{ color: 'var(--text-dark)', fontSize: '0.74rem', marginTop: '4px', display: 'block' }}>A name to identify this bot in your inbox.</small>
                          </label>
                          <label className="crm-add-lead-field" style={{ gridColumn: '1 / -1' }}>
                            <span>Bot Token <em>*</em></span>
                            <div style={{ position: 'relative' }}>
                              <input
                                type={showTgBotToken ? 'text' : 'password'}
                                required
                                value={tgBotToken}
                                onChange={(e) => setTgBotToken(e.target.value)}
                                placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyz"
                                style={{ width: '100%', paddingRight: '40px', fontFamily: 'monospace', fontSize: '0.82rem' }}
                              />
                              <button type="button" onClick={() => setShowTgBotToken(!showTgBotToken)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-dark)', fontSize: '0.75rem', padding: '4px' }}>
                                {showTgBotToken ? 'Hide' : 'Show'}
                              </button>
                            </div>
                            <small style={{ color: 'var(--text-dark)', fontSize: '0.74rem', marginTop: '4px', display: 'block' }}>Get this from @BotFather when you create your bot.</small>
                          </label>
                          <label className="crm-add-lead-field">
                            <span>Bot Username</span>
                            <input type="text" value={tgBotUsername} onChange={(e) => setTgBotUsername(e.target.value)} placeholder="my_sales_bot" />
                          </label>
                          <label className="crm-add-lead-field" style={{ gridColumn: '1 / -1' }}>
                            <span>Welcome Message</span>
                            <textarea
                              value={tgBotWelcomeMsg}
                              onChange={(e) => setTgBotWelcomeMsg(e.target.value)}
                              rows={2}
                              placeholder="Hi! Thanks for reaching out. Our team will get back to you shortly."
                              style={{ fontFamily: 'inherit', resize: 'vertical' }}
                            />
                            <small style={{ color: 'var(--text-dark)', fontSize: '0.74rem', marginTop: '4px', display: 'block' }}>Sent automatically when someone starts this bot with /start.</small>
                          </label>
                        </div>
                        {tgBotError && <div style={{ marginTop: '10px', fontSize: '0.82rem', color: '#dc2626' }}>{tgBotError}</div>}
                        {tgBotSuccess && <div style={{ marginTop: '10px', fontSize: '0.82rem', color: '#16a34a', fontWeight: 600 }}>Bot saved successfully!</div>}
                        <div style={{ marginTop: '14px', display: 'flex', gap: '10px' }}>
                          <button
                            type="button"
                            onClick={handleSaveTgBot}
                            disabled={tgBotSaving || !tgBotToken.trim()}
                            style={{ padding: '9px 18px', border: 'none', borderRadius: '8px', background: '#0088cc', color: '#fff', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', opacity: (tgBotSaving || !tgBotToken.trim()) ? 0.6 : 1 }}
                          >
                            {tgBotSaving ? <Loader2 size={14} className="crm-spin" /> : <Save size={14} />} {editingTgBotId ? 'Update Bot' : 'Add Bot'}
                          </button>
                          <button type="button" onClick={resetTgBotForm} style={{ padding: '9px 16px', border: '1px solid var(--border-subtle)', borderRadius: '8px', background: 'var(--bg-card)', color: 'var(--text-dark)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {tgBotError && <div style={{ marginTop: '8px', fontSize: '0.82rem', color: '#dc2626' }}>{tgBotError}</div>}
                </>
              ) : activeTab === 'lead_distribution' ? (
                <LeadDistributionPanel session={session} />
              ) : activeTab === 'pipeline_autoassign' ? (
                <>
                  <div className="crm-settings-card-header">
                    <h2 className="crm-settings-card-title"><GitBranch size={20} style={{ color: '#0f766e' }} /> Pipeline Auto-Assign</h2>
                    <p className="crm-settings-card-desc">When someone moves a lead from the “New” stage to any other pipeline stage, the lead is automatically assigned to them. This ensures every lead that gets worked on has a clear owner — no unassigned leads slipping through the cracks.</p>
                  </div>

                  <div style={{ background: 'rgba(15,118,110,0.06)', border: '1px solid rgba(15,118,110,0.2)', borderRadius: '10px', padding: '14px 16px', marginBottom: '16px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <GitBranch size={18} style={{ color: '#0f766e', flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      <strong>How it works:</strong> A new lead starts unassigned. The first person to move it from “New” to any stage below (e.g., Called, Interested, Converted) automatically becomes its owner. You can still manually reassign from the lead detail panel or Lead Distribution tab at any time.
                    </div>
                  </div>

                  <label className="crm-add-lead-field" style={{ flexDirection: 'row', alignItems: 'center', gap: '12px', padding: '16px', background: paEnabled ? 'rgba(15,118,110,0.06)' : 'var(--bg-light)', borderRadius: '10px', border: `1px solid ${paEnabled ? 'rgba(15,118,110,0.2)' : 'var(--border-subtle)'}`, cursor: 'pointer', transition: 'all 0.2s' }}>
                    <button
                      type="button"
                      onClick={() => setPaEnabled(!paEnabled)}
                      style={{
                        width: '44px', height: '24px', borderRadius: '12px', border: 'none',
                        background: paEnabled ? '#0f766e' : 'var(--text-dark)',
                        position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background 0.2s',
                      }}
                    >
                      <span style={{
                        position: 'absolute', top: '2px', left: paEnabled ? '22px' : '2px',
                        width: '20px', height: '20px', borderRadius: '50%', background: 'var(--bg-card)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s',
                      }} />
                    </button>
                    <div>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>Enable Pipeline Auto-Assign</span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-dark)', display: 'block' }}>Moving a lead from “New” to another stage auto-assigns it to the person who made the change</span>
                    </div>
                  </label>

                  {paEnabled && (
                    <div style={{ marginTop: '20px' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dark)', marginBottom: '10px' }}>Trigger Stages</div>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-dark)', marginBottom: '12px' }}>Choose which stage changes trigger auto-assignment. When a lead is moved from “New” to any of these stages, it gets assigned to the person who moved it.</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {([
                          { key: 'called_no_response', label: 'Called — No Response', color: '#F59E0B' },
                          { key: 'called_responded', label: 'Called — Responded', color: '#06B6D4' },
                          { key: 'interested', label: 'Interested', color: '#8B5CF6' },
                          { key: 'not_interested', label: 'Not Interested', color: '#EF4444' },
                          { key: 'converted', label: 'Converted', color: '#16A34A' },
                        ]).map((stage) => {
                          const checked = paStages.includes(stage.key);
                          return (
                            <label key={stage.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: checked ? 'rgba(15,118,110,0.04)' : 'var(--bg-light)', borderRadius: '8px', border: `1px solid ${checked ? 'rgba(15,118,110,0.15)' : 'var(--border-subtle)'}`, cursor: 'pointer', transition: 'all 0.15s' }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setPaStages((prev) =>
                                    prev.includes(stage.key) ? prev.filter((s) => s !== stage.key) : [...prev, stage.key]
                                  );
                                }}
                                style={{ width: '18px', height: '18px', accentColor: '#0f766e' }}
                              />
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: stage.color, flexShrink: 0 }} />
                              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>{stage.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {paError && <div style={{ marginTop: '12px', fontSize: '0.82rem', color: '#ef4444' }}>{paError}</div>}

                  <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      className="crm-add-lead-submit"
                      disabled={paSaving}
                      onClick={async () => {
                        setPaSaving(true);
                        setPaError('');
                        const payload = { user_id: session.user.id, enabled: paEnabled, assign_on_stages: paStages, updated_at: new Date().toISOString() };
                        const { data: existing } = await supabase.from('pipeline_autoassign_settings').select('id').maybeSingle();
                        const result = existing
                          ? await supabase.from('pipeline_autoassign_settings').update(payload).eq('id', existing.id)
                          : await supabase.from('pipeline_autoassign_settings').insert(payload);
                        setPaSaving(false);
                        if (result.error) { setPaError(result.error.message); }
                        else {
                          setPaSaved(true);
                          setTimeout(() => setPaSaved(false), 3000);
                          onPipelineAutoAssignChange?.(paEnabled, paStages);
                        }
                      }}
                      style={{ border: 'none', borderRadius: '10px', background: '#0f766e', color: 'var(--bg-card)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '6px', opacity: paSaving ? 0.6 : 1 }}
                    >
                      {paSaving ? <Loader2 size={16} className="crm-spin" /> : <Save size={16} />} Save Settings
                    </button>
                    {paSaved && <span style={{ fontSize: '0.82rem', color: '#16a34a', fontWeight: 600, alignSelf: 'center' }}>Saved!</span>}
                  </div>
                </>
              ) : activeTab === 'pipeline_stages' ? (
                <>
                  <div className="crm-settings-card-header">
                    <h2 className="crm-settings-card-title"><Tag size={20} style={{ color: '#0f766e' }} /> Pipeline Stage Labels</h2>
                    <p className="crm-settings-card-desc">Customize the names of each pipeline stage to match your business terminology. The underlying stage logic stays the same — only the display text changes across your CRM.</p>
                  </div>

                  <div style={{ background: 'rgba(15,118,110,0.06)', border: '1px solid rgba(15,118,110,0.2)', borderRadius: '10px', padding: '14px 16px', marginBottom: '16px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <Tag size={18} style={{ color: '#0f766e', flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      <strong>How it works:</strong> Each stage has a fixed internal key that powers automations, filters, and analytics. You're only changing the label that appears on screen — so your team sees terminology that makes sense for your business (e.g., "Contacted" instead of "Called - Responded"). Leave a field blank to use the default label.
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {PS_DEFAULT_STAGES.map((stage) => (
                      <div key={stage.key} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'var(--bg-light)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: stage.color, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: '200px' }}>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dark)', display: 'block', marginBottom: '4px' }}>
                            {stage.defaultLabel}
                          </label>
                          <input
                            type="text"
                            value={psLabels[stage.key] ?? ''}
                            onChange={(e) => { setPsLabels((prev) => ({ ...prev, [stage.key]: e.target.value })); setPsSaved(false); }}
                            placeholder={stage.defaultLabel}
                            style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-subtle)', borderRadius: '8px', fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)', outline: 'none', transition: 'border 0.15s' }}
                            onFocus={(e) => { e.currentTarget.style.borderColor = '#0f766e'; }}
                            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {psError && <div style={{ marginTop: '12px', fontSize: '0.82rem', color: '#ef4444' }}>{psError}</div>}

                  <div style={{ marginTop: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                      type="button"
                      disabled={psSaving}
                      onClick={async () => {
                        setPsSaving(true);
                        setPsError('');
                        try {
                          const { data: sessionData } = await supabase.auth.getSession();
                          const userId = sessionData.session?.user.id;
                          if (!userId) { setPsError('Not authenticated'); setPsSaving(false); return; }
                          for (const stage of PS_DEFAULT_STAGES) {
                            const label = (psLabels[stage.key] ?? '').trim();
                            if (!label || label === stage.defaultLabel) {
                              await supabase.from('pipeline_stage_labels').delete().eq('user_id', userId).eq('stage_key', stage.key);
                            } else {
                              await supabase.from('pipeline_stage_labels').upsert(
                                { user_id: userId, stage_key: stage.key, label, updated_at: new Date().toISOString() },
                                { onConflict: 'user_id,stage_key' }
                              );
                            }
                          }
                          setPsSaved(true);
                          setTimeout(() => setPsSaved(false), 3000);
                          onStageLabelsChange?.();
                        } catch (err) {
                          setPsError(err instanceof Error ? err.message : 'Failed to save labels');
                        }
                        setPsSaving(false);
                      }}
                      style={{ border: 'none', borderRadius: '10px', background: '#0f766e', color: 'var(--bg-card)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '6px', opacity: psSaving ? 0.6 : 1 }}
                    >
                      {psSaving ? <Loader2 size={16} className="crm-spin" /> : <Save size={16} />} Save Labels
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPsLabels({}); setPsSaved(false); }}
                      style={{ padding: '10px 16px', border: '1px solid var(--border-subtle)', borderRadius: '10px', background: 'var(--bg-card)', color: 'var(--text-dark)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <RotateCcw size={14} /> Reset to Defaults
                    </button>
                    {psSaved && <span style={{ fontSize: '0.82rem', color: '#16a34a', fontWeight: 600 }}>Saved!</span>}
                  </div>
                </>
              ) : activeTab === 'assignment' ? (
                <>
                  <div className="crm-settings-card-header">
                    <h2 className="crm-settings-card-title"><Shuffle size={20} style={{ color: '#0f766e' }} /> Lead Assignment</h2>
                    <p className="crm-settings-card-desc">Automatically distribute new leads among your active team members. Choose a strategy that fits your team's workflow.</p>
                  </div>

                  {assignmentMembers.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dark)' }}>
                      <Users size={36} style={{ marginBottom: '10px', opacity: 0.4 }} />
                      <p style={{ fontSize: '0.88rem', marginBottom: '4px' }}>No active team members</p>
                      <p style={{ fontSize: '0.8rem' }}>Invite team members from the Team tab first. Only active members are eligible for auto-assignment.</p>
                    </div>
                  ) : (
                    <>
                      <label className="crm-add-lead-field" style={{ flexDirection: 'row', alignItems: 'center', gap: '12px', padding: '16px', background: autoAssignEnabled ? 'rgba(15,118,110,0.06)' : 'var(--bg-light)', borderRadius: '10px', border: `1px solid ${autoAssignEnabled ? 'rgba(15,118,110,0.2)' : 'var(--border-subtle)'}`, cursor: 'pointer', transition: 'all 0.2s' }}>
                        <button
                          type="button"
                          onClick={() => setAutoAssignEnabled(!autoAssignEnabled)}
                          style={{
                            width: '44px', height: '24px', borderRadius: '12px', border: 'none',
                            background: autoAssignEnabled ? '#0f766e' : 'var(--text-dark)',
                            position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background 0.2s',
                          }}
                        >
                          <span style={{
                            position: 'absolute', top: '2px', left: autoAssignEnabled ? '22px' : '2px',
                            width: '20px', height: '20px', borderRadius: '50%', background: 'var(--bg-card)',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s',
                          }} />
                        </button>
                        <div>
                          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>Auto-assign leads</span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-dark)', display: 'block' }}>New leads are automatically distributed to active team members</span>
                        </div>
                      </label>

                      {autoAssignEnabled && (
                        <div style={{ marginTop: '16px' }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dark)', marginBottom: '10px' }}>Assignment Strategy</div>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {([
                              { key: 'round_robin' as const, label: 'Round Robin', desc: 'Cycle through agents in order' },
                              { key: 'workload' as const, label: 'Fewest Leads', desc: 'Assign to agent with least leads' },
                              { key: 'expertise' as const, label: 'Top Performer', desc: 'Assign to highest conversion rate' },
                            ]).map((opt) => (
                              <button
                                key={opt.key}
                                type="button"
                                onClick={() => setAssignmentStrategy(opt.key)}
                                style={{
                                  padding: '12px 16px', borderRadius: '10px', border: `2px solid ${assignmentStrategy === opt.key ? '#0f766e' : 'var(--border-subtle)'}`,
                                  background: assignmentStrategy === opt.key ? 'rgba(15,118,110,0.06)' : 'var(--bg-card)', cursor: 'pointer',
                                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', flex: '1', minWidth: '140px',
                                  transition: 'all 0.2s',
                                }}
                              >
                                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: assignmentStrategy === opt.key ? '#0f766e' : 'var(--text-main)' }}>{opt.label}</span>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-dark)' }}>{opt.desc}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div style={{ marginTop: '20px' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dark)', marginBottom: '10px' }}>
                          Eligible Agents ({assignmentMembers.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {assignmentMembers.map((member, idx) => (
                            <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'var(--bg-light)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #0f766e, #14b8a6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bg-card)', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>
                                {idx + 1}
                              </div>
                              <div style={{ flex: 1 }}>
                                <strong style={{ fontSize: '0.85rem' }}>{member.full_name || member.email}</strong>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-dark)', display: 'block' }}>{member.email}</span>
                              </div>
                              <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', padding: '3px 8px', borderRadius: '4px', background: 'rgba(15,118,110,0.12)', color: '#0f766e' }}>
                                {member.role}
                              </span>
                            </div>
                          ))}
                        </div>
                        <p style={{ fontSize: '0.76rem', color: 'var(--text-dark)', marginTop: '10px', lineHeight: 1.5 }}>
                          {assignmentStrategy === 'round_robin'
                            ? 'Leads are assigned in order, cycling back to the first agent after the last.'
                            : assignmentStrategy === 'workload'
                            ? 'Leads go to the agent with the fewest current assignments, balancing the workload.'
                            : 'Leads go to the agent with the highest conversion rate, maximizing close probability.'}
                          {' '}Disable a member from the Team tab to exclude them.
                        </p>
                      </div>
                    </>
                  )}
                </>
              ) : activeTab === 'meta' ? (
                <>
                  <div className="crm-settings-card-header">
                    <h2 className="crm-settings-card-title"><TrendingUp size={20} style={{ color: '#1877F2' }} /> Meta Conversion API</h2>
                    <p className="crm-settings-card-desc">Send conversion events from your CRM back to Meta (Facebook/Instagram). When a lead's status changes, Meta learns which leads convert so it can optimize your ads for higher-quality leads.</p>
                  </div>

                  <div style={{ background: 'rgba(24,119,242,0.06)', border: '1px solid rgba(24,119,242,0.2)', borderRadius: '10px', padding: '14px 16px', marginBottom: '16px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <TrendingUp size={18} style={{ color: '#1877F2', flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      <strong>How it works:</strong> When you move a lead to a new stage (e.g., Interested or Converted), your CRM automatically sends that event to Meta. Meta uses this data to optimize your Lead Ads toward audiences that actually convert.
                    </div>
                  </div>

                  <div className="crm-add-lead-grid">
                    <label className="crm-add-lead-field" style={{ gridColumn: '1 / -1' }}>
                      <span>Meta Pixel ID <em>*</em></span>
                      <input type="text" required value={metaPixelId} onChange={(e) => setMetaPixelId(e.target.value)} placeholder="123456789012345" style={{ fontFamily: 'monospace', fontSize: '0.82rem' }} />
                      <small style={{ color: 'var(--text-dark)', fontSize: '0.74rem', marginTop: '4px', display: 'block' }}>
                        Found in Meta Business Manager under Events Manager &gt; Data Sources &gt; your Pixel.
                      </small>
                    </label>
                    <label className="crm-add-lead-field" style={{ gridColumn: '1 / -1' }}>
                      <span>Access Token <em>*</em></span>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showMetaToken ? 'text' : 'password'}
                          required
                          value={metaAccessToken}
                          onChange={(e) => setMetaAccessToken(e.target.value)}
                          placeholder="EAAGxxxxxxxxxxxxxxxxx"
                          style={{ width: '100%', paddingRight: '40px', fontFamily: 'monospace', fontSize: '0.82rem' }}
                        />
                        <button type="button" onClick={() => setShowMetaToken(!showMetaToken)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-dark)', fontSize: '0.75rem', padding: '4px' }}>
                          {showMetaToken ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      <small style={{ color: 'var(--text-dark)', fontSize: '0.74rem', marginTop: '4px', display: 'block' }}>
                        Generate a Conversions API access token in Meta Business Manager under Settings &gt; Conversions API.
                      </small>
                    </label>
                    <label className="crm-add-lead-field">
                      <span>Graph API Version</span>
                      <input type="text" value={metaApiVersion} onChange={(e) => setMetaApiVersion(e.target.value)} placeholder="v18.0" style={{ fontFamily: 'monospace', fontSize: '0.82rem' }} />
                    </label>
                    <label className="crm-add-lead-field" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
                      <input type="checkbox" checked={metaEnabled} onChange={(e) => setMetaEnabled(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#1877F2' }} />
                      <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>Enable conversion event sending</span>
                    </label>
                    <label className="crm-add-lead-field" style={{ gridColumn: '1 / -1' }}>
                      <span>CRM Name (Lead Event Source)</span>
                      <input type="text" value={metaLeadEventSource} onChange={(e) => setMetaLeadEventSource(e.target.value)} placeholder="SahilExchange CRM" style={{ fontSize: '0.85rem', fontWeight: 600 }} />
                      <small style={{ color: 'var(--text-dark)', fontSize: '0.74rem', marginTop: '4px', display: 'block' }}>
                        Sent to Meta as <code>lead_event_source</code> in every event. Meta uses this to identify your CRM in their CRM Lead Status Integration.
                      </small>
                    </label>
                  </div>

                  <div style={{ marginTop: '16px', padding: '16px', background: 'var(--bg-light)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Purchase Event Value Settings</div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-dark)', marginBottom: '16px' }}>Meta requires a <strong>value</strong> and <strong>currency</strong> for all Purchase events. When a lead is converted, the CRM sends the purchase value if set, then falls back to the fund amount, then to the default value below.</p>
                    <div className="crm-add-lead-grid">
                      <label className="crm-add-lead-field">
                        <span>Currency (ISO 4217)</span>
                        <select
                          value={metaCurrency}
                          onChange={(e) => setMetaCurrency(e.target.value)}
                          style={{ cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                        >
                          <option value="USD">USD — US Dollar</option>
                          <option value="EUR">EUR — Euro</option>
                          <option value="GBP">GBP — British Pound</option>
                          <option value="INR">INR — Indian Rupee</option>
                          <option value="AED">AED — UAE Dirham</option>
                          <option value="SAR">SAR — Saudi Riyal</option>
                          <option value="SGD">SGD — Singapore Dollar</option>
                          <option value="AUD">AUD — Australian Dollar</option>
                          <option value="CAD">CAD — Canadian Dollar</option>
                          <option value="ZAR">ZAR — South African Rand</option>
                          <option value="NGN">NGN — Nigerian Naira</option>
                          <option value="KES">KES — Kenyan Shilling</option>
                          <option value="PKR">PKR — Pakistani Rupee</option>
                          <option value="BDT">BDT — Bangladeshi Taka</option>
                          <option value="LKR">LKR — Sri Lankan Rupee</option>
                          <option value="NPR">NPR — Nepalese Rupee</option>
                          <option value="JPY">JPY — Japanese Yen</option>
                          <option value="CNY">CNY — Chinese Yuan</option>
                          <option value="MYR">MYR — Malaysian Ringgit</option>
                          <option value="IDR">IDR — Indonesian Rupiah</option>
                          <option value="PHP">PHP — Philippine Peso</option>
                          <option value="THB">THB — Thai Baht</option>
                          <option value="VND">VND — Vietnamese Dong</option>
                          <option value="BRL">BRL — Brazilian Real</option>
                          <option value="MXN">MXN — Mexican Peso</option>
                          <option value="TRY">TRY — Turkish Lira</option>
                          <option value="EGP">EGP — Egyptian Pound</option>
                          <option value="GHS">GHS — Ghanaian Cedi</option>
                          <option value="TZS">TZS — Tanzanian Shilling</option>
                          <option value="UGX">UGX — Ugandan Shilling</option>
                        </select>
                        <small style={{ color: 'var(--text-dark)', fontSize: '0.74rem', marginTop: '4px', display: 'block' }}>
                          The currency code sent with every Purchase event to Meta.
                        </small>
                      </label>
                      <label className="crm-add-lead-field">
                        <span>Default Purchase Value (fallback)</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={metaDefaultValue}
                          onChange={(e) => setMetaDefaultValue(e.target.value)}
                          placeholder="e.g. 100.00"
                          style={{ fontSize: '0.85rem', fontWeight: 600 }}
                        />
                        <small style={{ color: 'var(--text-dark)', fontSize: '0.74rem', marginTop: '4px', display: 'block' }}>
                          Used only when a converted lead has no purchase value or fund amount set. Ensures Meta always receives a valid value.
                        </small>
                      </label>
                    </div>
                  </div>

                  <div style={{ marginTop: '20px', padding: '16px', background: 'var(--bg-light)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Event Mapping</div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-dark)', marginBottom: '16px' }}>Choose which Meta event to send when a lead moves to each stage. Set to <strong>None</strong> to skip sending for that stage.</p>
                    {([
                      { key: 'new' as const, label: 'New Lead', color: '#3B82F6' },
                      { key: 'called_no_response' as const, label: 'Called — No Response', color: '#F59E0B' },
                      { key: 'called_responded' as const, label: 'Called — Responded', color: '#F59E0B' },
                      { key: 'interested' as const, label: 'Interested', color: '#8B5CF6' },
                      { key: 'not_interested' as const, label: 'Not Interested', color: '#EF4444' },
                      { key: 'converted' as const, label: 'Converted', color: '#16A34A' },
                    ]).map((stage) => (
                      <div key={stage.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: stage.color, flexShrink: 0 }} />
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>{stage.label}</span>
                        </div>
                        <select
                          value={eventMapping[stage.key]}
                          onChange={(e) => setEventMapping((prev) => ({ ...prev, [stage.key]: e.target.value }))}
                          style={{
                            padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)',
                            background: 'var(--bg-card)', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)',
                            cursor: 'pointer', outline: 'none', minWidth: '140px',
                          }}
                        >
                          <option value="None">None (skip)</option>
                          {META_EVENT_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                    <div style={{ marginTop: '12px', padding: '10px 12px', background: 'rgba(24,119,242,0.06)', borderRadius: '8px', fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      <strong>Tip:</strong> The <strong>Purchase</strong> event automatically includes a <strong>value</strong> and <strong>currency</strong>. It uses the lead's purchase value if set, then the fund amount, then the default value from the settings above. <strong>None</strong> means no event is sent for that stage.
                    </div>
                  </div>

                  {/* Setup documentation */}
                  <details style={{ marginTop: '20px', border: '1px solid var(--border-subtle)', borderRadius: '10px', background: 'var(--bg-light)', overflow: 'hidden' }}>
                    <summary style={{ padding: '14px 16px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', listStyle: 'none', userSelect: 'none' }}>
                      <BookOpen size={18} style={{ color: '#1877F2' }} />
                      Complete Setup Guide: Meta Conversion API Configuration & Event Mapping
                      <ChevronDown size={16} style={{ marginLeft: 'auto', color: 'var(--text-dark)', transition: 'transform 0.2s' }} />
                    </summary>
                    <div style={{ padding: '0 16px 16px', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>

                      {/* What is CAPI */}
                      <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main)', margin: '16px 0 8px', paddingBottom: '6px', borderBottom: '2px solid #1877F2', display: 'inline-block' }}>What is the Meta Conversions API?</h4>
                      <p style={{ margin: '0 0 12px' }}>
                        The Meta Conversions API (CAPI) is a server-side tracking method that sends conversion events directly from your CRM to Meta's servers — no browser pixel required. When you move a lead through your pipeline stages (New &rarr; Called &rarr; Interested &rarr; Converted), the CRM automatically sends the corresponding event to Meta. Meta uses this data to optimize your Facebook and Instagram Lead Ads, showing your ads to people more likely to actually convert rather than just fill out the form.
                      </p>
                      <div style={{ padding: '10px 14px', background: 'rgba(24,119,242,0.06)', borderRadius: '8px', border: '1px solid rgba(24,119,242,0.15)', margin: '0 0 16px', fontSize: '0.78rem' }}>
                        <strong>Why server-side?</strong> Browser pixels lose data to ad blockers and iOS tracking restrictions. Server-side events are sent from your CRM's server, so they're more reliable and complete. This means Meta gets better data and optimizes your ads more effectively.
                      </div>

                      {/* Prerequisites */}
                      <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main)', margin: '16px 0 8px', paddingBottom: '6px', borderBottom: '2px solid #1877F2', display: 'inline-block' }}>Prerequisites</h4>
                      <ul style={{ margin: '0 0 12px', paddingLeft: '20px' }}>
                        <li>A <strong>Meta Business Manager</strong> account (free at <span style={{ fontFamily: 'monospace' }}>business.facebook.com</span>).</li>
                        <li>A <strong>Facebook Page</strong> connected to your Business Manager.</li>
                        <li>A <strong>Meta Pixel</strong> created (or ready to create) in the Events Manager.</li>
                        <li><strong>Admin or Developer access</strong> to the Business Manager account.</li>
                        <li>Your CRM must have at least one lead to test with.</li>
                      </ul>

                      {/* Step 1 */}
                      <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main)', margin: '16px 0 8px', paddingBottom: '6px', borderBottom: '2px solid #1877F2', display: 'inline-block' }}>Step 1 &mdash; Create or find your Meta Pixel</h4>
                      <ol style={{ margin: '0 0 12px', paddingLeft: '20px' }}>
                        <li>Go to <strong>Meta Business Manager</strong> &rarr; <strong>Events Manager</strong>.</li>
                        <li>Click <strong>Data Sources</strong> in the left sidebar, then <strong>+ Add New Data Source</strong> &rarr; <strong>Web</strong>.</li>
                        <li>Name your Pixel (e.g., "LeadCentre CRM Pixel") and connect your website domain.</li>
                        <li>Once created, open the Pixel settings and copy the <strong>Pixel ID</strong> — a long number like <span style={{ fontFamily: 'monospace', background: 'var(--bg-light)', padding: '2px 6px', borderRadius: '4px' }}>123456789012345</span>.</li>
                        <li>Paste that number into the <strong>Meta Pixel ID</strong> field above.</li>
                      </ol>

                      {/* Step 2 */}
                      <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main)', margin: '16px 0 8px', paddingBottom: '6px', borderBottom: '2px solid #1877F2', display: 'inline-block' }}>Step 2 &mdash; Generate a Conversions API Access Token</h4>
                      <ol style={{ margin: '0 0 12px', paddingLeft: '20px' }}>
                        <li>In <strong>Events Manager</strong>, open your Pixel's <strong>Settings</strong> tab.</li>
                        <li>Scroll to the <strong>Conversions API</strong> section and click <strong>Set up</strong>.</li>
                        <li>Choose <strong>Direct Integration</strong> (not Partner — this CRM connects directly).</li>
                        <li>Under <strong>Access Token</strong>, click <strong>Generate Access Token</strong>.</li>
                        <li>A long string starting with <span style={{ fontFamily: 'monospace', background: 'var(--bg-light)', padding: '2px 6px', borderRadius: '4px' }}>EAAG...</span> will appear.</li>
                        <li><strong>Copy this token immediately</strong> — Meta only shows it once. Store it securely.</li>
                        <li>Paste it into the <strong>Access Token</strong> field above.</li>
                      </ol>
                      <div style={{ padding: '10px 14px', background: 'var(--bg-card-hover)', borderRadius: '8px', border: '1px solid #fde68a', margin: '0 0 12px', fontSize: '0.78rem', color: '#92400e' }}>
                        <strong>Important:</strong> If you lose this token, you'll need to generate a new one in Meta and paste it here again. The old token stops working.
                      </div>

                      {/* Step 3 */}
                      <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main)', margin: '16px 0 8px', paddingBottom: '6px', borderBottom: '2px solid #1877F2', display: 'inline-block' }}>Step 3 &mdash; Set the Graph API Version</h4>
                      <p style={{ margin: '0 0 12px' }}>
                        The Graph API Version tells Meta which API version to use. The default is <span style={{ fontFamily: 'monospace', background: 'var(--bg-light)', padding: '2px 6px', borderRadius: '4px' }}>v18.0</span>, which is stable and recommended. Meta releases new versions periodically — check <span style={{ fontFamily: 'monospace' }}>developers.facebook.com/docs/graph-api</span> for the latest. Leave it as-is unless Meta has deprecated your version.
                      </p>

                      {/* Step 4 — Event Mapping */}
                      <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main)', margin: '16px 0 8px', paddingBottom: '6px', borderBottom: '2px solid #1877F2', display: 'inline-block' }}>Step 4 &mdash; Map your CRM stages to Meta events</h4>
                      <p style={{ margin: '0 0 12px' }}>
                        This is the most important step. The <strong>Event Mapping</strong> section above lets you choose which Meta event gets sent when a lead moves to each CRM stage. Each dropdown controls one stage:
                      </p>
                      <div style={{ overflowX: 'auto', margin: '0 0 12px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                          <thead>
                            <tr style={{ background: 'var(--border-subtle)' }}>
                              <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--text-main)', borderRadius: '6px 0 0 0' }}>CRM Stage</th>
                              <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--text-main)' }}>What it means</th>
                              <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--text-main)', borderRadius: '0 6px 0 0' }}>Default Meta Event</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <td style={{ padding: '8px 10px', fontWeight: 600, color: '#3B82F6' }}>New Lead</td>
                              <td style={{ padding: '8px 10px', color: 'var(--text-dark)' }}>A brand new lead just entered your CRM</td>
                              <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text-main)' }}>Lead</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-light)' }}>
                              <td style={{ padding: '8px 10px', fontWeight: 600, color: '#F59E0B' }}>Called &mdash; No Response</td>
                              <td style={{ padding: '8px 10px', color: 'var(--text-dark)' }}>You called but the lead didn't pick up</td>
                              <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text-main)' }}>Contact</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <td style={{ padding: '8px 10px', fontWeight: 600, color: '#F59E0B' }}>Called &mdash; Responded</td>
                              <td style={{ padding: '8px 10px', color: 'var(--text-dark)' }}>You called and the lead answered</td>
                              <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text-main)' }}>Contact</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-light)' }}>
                              <td style={{ padding: '8px 10px', fontWeight: 600, color: '#8B5CF6' }}>Interested</td>
                              <td style={{ padding: '8px 10px', color: 'var(--text-dark)' }}>The lead showed interest in your product</td>
                              <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text-main)' }}>Contact</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <td style={{ padding: '8px 10px', fontWeight: 600, color: '#EF4444' }}>Not Interested</td>
                              <td style={{ padding: '8px 10px', color: 'var(--text-dark)' }}>The lead declined your offer</td>
                              <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text-main)' }}>Lead</td>
                            </tr>
                            <tr style={{ background: 'var(--bg-light)' }}>
                              <td style={{ padding: '8px 10px', fontWeight: 600, color: '#16A34A' }}>Converted</td>
                              <td style={{ padding: '8px 10px', color: 'var(--text-dark)' }}>The lead became a paying customer</td>
                              <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text-main)' }}>Purchase</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', margin: '16px 0 8px' }}>How to customize the mapping</h4>
                      <ol style={{ margin: '0 0 12px', paddingLeft: '20px' }}>
                        <li>Find the <strong>Event Mapping</strong> section above (below the Access Token field).</li>
                        <li>For each CRM stage, open the dropdown and select the Meta event you want to send.</li>
                        <li>Choose <strong>None (skip)</strong> if you don't want any event sent for that stage.</li>
                        <li>Click <strong>Save Settings</strong> at the bottom of the page.</li>
                        <li>The new mapping takes effect immediately — the next lead status change will use it.</li>
                      </ol>

                      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', margin: '16px 0 8px' }}>Available Meta events you can map to</h4>
                      <div style={{ overflowX: 'auto', margin: '0 0 12px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                          <thead>
                            <tr style={{ background: 'var(--border-subtle)' }}>
                              <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--text-main)', borderRadius: '6px 0 0 0' }}>Event Name</th>
                              <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--text-main)', borderRadius: '0 6px 0 0' }}>When Meta uses it</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <td style={{ padding: '8px 10px', fontWeight: 600, color: '#1877F2' }}>Lead</td>
                              <td style={{ padding: '8px 10px', color: 'var(--text-dark)' }}>Someone submitted a lead form. Meta optimizes for form submissions.</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-light)' }}>
                              <td style={{ padding: '8px 10px', fontWeight: 600, color: '#1877F2' }}>Contact</td>
                              <td style={{ padding: '8px 10px', color: 'var(--text-dark)' }}>Someone was contacted (call, message). Meta optimizes for engagement.</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <td style={{ padding: '8px 10px', fontWeight: 600, color: '#1877F2' }}>Purchase</td>
                              <td style={{ padding: '8px 10px', color: 'var(--text-dark)' }}>Someone completed a purchase. Includes the lead's fund amount as the value. Meta optimizes for revenue.</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-light)' }}>
                              <td style={{ padding: '8px 10px', fontWeight: 600, color: '#1877F2' }}>AddToCart</td>
                              <td style={{ padding: '8px 10px', color: 'var(--text-dark)' }}>Someone added a product to cart. Useful for e-commerce-style funnels.</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <td style={{ padding: '8px 10px', fontWeight: 600, color: '#1877F2' }}>InitiateCheckout</td>
                              <td style={{ padding: '8px 10px', color: 'var(--text-dark)' }}>Someone started checkout. Maps well to "Interested" stage.</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-light)' }}>
                              <td style={{ padding: '8px 10px', fontWeight: 600, color: '#1877F2' }}>Subscribe</td>
                              <td style={{ padding: '8px 10px', color: 'var(--text-dark)' }}>Someone subscribed to a service or newsletter.</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <td style={{ padding: '8px 10px', fontWeight: 600, color: '#1877F2' }}>CompleteRegistration</td>
                              <td style={{ padding: '8px 10px', color: 'var(--text-dark)' }}>Someone completed a registration form.</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-light)' }}>
                              <td style={{ padding: '8px 10px', fontWeight: 600, color: '#1877F2' }}>Custom</td>
                              <td style={{ padding: '8px 10px', color: 'var(--text-dark)' }}>A custom event you've defined in Meta. Use for non-standard funnel steps.</td>
                            </tr>
                            <tr>
                              <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text-dark)' }}>None (skip)</td>
                              <td style={{ padding: '8px 10px', color: 'var(--text-dark)' }}>No event is sent for this stage. Use for stages you don't want to track.</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <div style={{ padding: '12px 14px', background: 'rgba(22,163,74,0.08)', borderRadius: '8px', border: '1px solid rgba(22,163,74,0.2)', margin: '0 0 12px', fontSize: '0.78rem', color: '#166534' }}>
                        <strong>Recommended mapping for a trading/finance CRM:</strong><br />
                        New Lead &rarr; <strong>Lead</strong> (tells Meta a lead came in)<br />
                        Called (both) &rarr; <strong>Contact</strong> (tells Meta the lead was engaged)<br />
                        Interested &rarr; <strong>InitiateCheckout</strong> (lead is considering buying)<br />
                        Not Interested &rarr; <strong>None</strong> (skip — no need to track rejections)<br />
                        Converted &rarr; <strong>Purchase</strong> (lead paid — includes fund amount as value)
                      </div>

                      {/* Step 5 */}
                      <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main)', margin: '16px 0 8px', paddingBottom: '6px', borderBottom: '2px solid #1877F2', display: 'inline-block' }}>Step 5 &mdash; Enable and save</h4>
                      <ol style={{ margin: '0 0 12px', paddingLeft: '20px' }}>
                        <li>Check the <strong>"Enable conversion event sending"</strong> checkbox above.</li>
                        <li>Double-check your Pixel ID and Access Token have no extra spaces.</li>
                        <li>Click <strong>Save Settings</strong> at the bottom of this page.</li>
                        <li>Once saved, your CRM will automatically send events to Meta every time a lead's status changes — no further action needed.</li>
                      </ol>

                      {/* Step 6 */}
                      <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main)', margin: '16px 0 8px', paddingBottom: '6px', borderBottom: '2px solid #1877F2', display: 'inline-block' }}>Step 6 &mdash; Verify events are received</h4>
                      <ol style={{ margin: '0 0 12px', paddingLeft: '20px' }}>
                        <li>Move a test lead to a different stage (e.g., from "New" to "Interested").</li>
                        <li>Return to <strong>Events Manager</strong> &rarr; your Pixel &rarr; <strong>Test Events</strong> tab.</li>
                        <li>You should see events arriving within 5-20 seconds (Lead, Contact, Purchase, etc. depending on the stage and your mapping).</li>
                        <li>Check the <strong>Recent Conversion Events</strong> log below — green checkmarks mean Meta accepted the event; red X's mean something went wrong.</li>
                        <li>Click on any event in Meta's Test Events tab to see the full payload including user data (hashed phone/email) and custom data (status, fund amount).</li>
                      </ol>

                      {/* What data is sent */}
                      <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main)', margin: '16px 0 8px', paddingBottom: '6px', borderBottom: '2px solid #1877F2', display: 'inline-block' }}>What data is sent to Meta?</h4>
                      <p style={{ margin: '0 0 8px' }}>Each event includes the following information:</p>
                      <ul style={{ margin: '0 0 12px', paddingLeft: '20px' }}>
                        <li><strong>Event name</strong> — the Meta event you mapped to (Lead, Contact, Purchase, etc.)</li>
                        <li><strong>Event time</strong> — the exact timestamp of the status change</li>
                        <li><strong>Hashed phone number</strong> — if the lead has a mobile number, it's SHA-256 hashed and sent for matching</li>
                        <li><strong>Hashed email</strong> — if the lead has an email, it's SHA-256 hashed and sent for matching</li>
                        <li><strong>Meta Lead ID</strong> — if the lead came from Meta Ads, the original lead ID is included for exact matching</li>
                        <li><strong>Status</strong> — the CRM stage name (new, interested, converted, etc.) sent as custom data</li>
                        <li><strong>Fund amount</strong> — included as the purchase value only when the event is "Purchase" and the lead has a fund amount set</li>
                      </ul>
                      <div style={{ padding: '10px 14px', background: 'rgba(24,119,242,0.06)', borderRadius: '8px', border: '1px solid rgba(24,119,242,0.15)', margin: '0 0 12px', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                        <strong>Privacy note:</strong> All phone numbers and emails are SHA-256 hashed before being sent to Meta. Meta cannot see the raw data — only the hash. This complies with Meta's data handling requirements.
                      </div>

                      {/* Troubleshooting */}
                      <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main)', margin: '16px 0 8px', paddingBottom: '6px', borderBottom: '2px solid #EF4444', display: 'inline-block' }}>Troubleshooting</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '0 0 12px' }}>
                        <div style={{ padding: '10px 12px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                          <strong style={{ color: '#ef4444' }}>No events appearing in Meta</strong><br />
                          <span style={{ color: 'var(--text-dark)' }}>Check that "Enable" is checked and settings are saved. Verify the Pixel ID and Access Token have no trailing spaces. Make sure the Pixel ID is numeric only (no letters).</span>
                        </div>
                        <div style={{ padding: '10px 12px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                          <strong style={{ color: '#ef4444' }}>Events show as errors (red X) in the log</strong><br />
                          <span style={{ color: 'var(--text-dark)' }}>The access token may have expired or been revoked. Regenerate it in Events Manager and paste the new token here. Also check that the Pixel ID matches the token's Pixel.</span>
                        </div>
                        <div style={{ padding: '10px 12px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                          <strong style={{ color: '#ef4444' }}>Events delayed in Meta Test Events tab</strong><br />
                          <span style={{ color: 'var(--text-dark)' }}>Meta can take 5-20 seconds to display server-side events. Wait, then refresh the Test Events page. Events sent successfully (green checkmark in the log below) will appear in Meta.</span>
                        </div>
                        <div style={{ padding: '10px 12px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                          <strong style={{ color: '#ef4444' }}>Wrong API version error</strong><br />
                          <span style={{ color: 'var(--text-dark)' }}>Make sure the version field is a valid format like <span style={{ fontFamily: 'monospace' }}>v18.0</span> (with the "v" prefix and ".0" suffix). Check Meta's docs for the current version.</span>
                        </div>
                        <div style={{ padding: '10px 12px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                          <strong style={{ color: '#ef4444' }}>Purchase event has no value</strong><br />
                          <span style={{ color: 'var(--text-dark)' }}>The lead must have a fund amount set before moving to "Converted" status. Edit the lead, add the fund amount, then change the status to "Converted".</span>
                        </div>
                        <div style={{ padding: '10px 12px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                          <strong style={{ color: '#ef4444' }}>Stage mapped to "None" but still sending events</strong><br />
                          <span style={{ color: 'var(--text-dark)' }}>Make sure you clicked Save Settings after changing the mapping. If the issue persists, refresh the page and verify the dropdown still shows "None".</span>
                        </div>
                      </div>

                      {/* Security tip */}
                      <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(24,119,242,0.08)', borderRadius: '8px', border: '1px solid rgba(24,119,242,0.2)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        <strong>Security tip:</strong> Keep your Access Token secure. Anyone with the token can send events to your Pixel. If you suspect it was leaked, regenerate it in Meta and update it here immediately. Never share it in screenshots or support chats.
                      </div>

                      <p style={{ marginTop: '12px', fontSize: '0.76rem', color: 'var(--text-dark)' }}>
                        Official Meta documentation: <span style={{ fontFamily: 'monospace' }}>developers.facebook.com/docs/marketing-api/conversions-api</span>
                      </p>
                    </div>
                  </details>

                  {metaConversionLog.length > 0 && (
                    <div style={{ marginTop: '20px' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dark)', marginBottom: '12px' }}>
                        Recent Conversion Events ({metaConversionLog.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {metaConversionLog.map((log) => (
                          <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: 'var(--bg-light)', borderRadius: '6px', border: '1px solid var(--border-subtle)', fontSize: '0.78rem' }}>
                            {log.success
                              ? <CheckCircle2 size={14} style={{ color: '#16a34a', flexShrink: 0 }} />
                              : <XCircle size={14} style={{ color: '#ef4444', flexShrink: 0 }} />}
                            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{log.event_name}</span>
                            <span style={{ color: 'var(--text-dark)' }}>{new Date(log.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
                            {log.error_message && <span style={{ color: '#ef4444', fontSize: '0.72rem', marginLeft: 'auto' }}>{log.error_message}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : activeTab === 'section_visibility' ? (
                <>
                  <div className="crm-settings-card-header">
                    <h2 className="crm-settings-card-title"><Eye size={20} style={{ color: '#2563eb' }} /> Section Visibility</h2>
                    <p className="crm-settings-card-desc">Choose which pages appear in the CRM sidebar. Hidden pages stay accessible via direct navigation but won't clutter your sidebar. Changes are saved to your account and sync across devices.</p>
                  </div>

                  {sectionVisSaved && (
                    <div style={{ background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.3)', borderRadius: '8px', padding: '12px 16px', color: '#16a34a', fontSize: '0.85rem', fontWeight: 600, marginTop: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={16} /> Section visibility saved successfully.
                    </div>
                  )}

                  {error && activeTab === 'section_visibility' && (
                    <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '12px 16px', color: '#dc2626', fontSize: '0.85rem', fontWeight: 600, marginTop: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AlertTriangle size={16} /> {error}
                    </div>
                  )}

                  <div className="appearance-section" style={{ marginBottom: '20px' }}>
                    <p className="appearance-section-desc" style={{ marginBottom: '16px' }}>Toggle individual pages on or off. Dashboard and Settings are always visible.</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {[
                        { key: 'leads', label: 'Leads', sub: 'View and manage all your leads', icon: <Users size={18} />, iconBg: 'rgba(59,130,246,0.1)', iconColor: '#3B82F6' },
                        { key: 'brokers', label: 'Broker Tracker', sub: 'Track broker relationships and performance', icon: <TrendingUp size={18} />, iconBg: 'rgba(234,179,8,0.1)', iconColor: '#EAB308' },
                        { key: 'inbox', label: 'Shared Inbox', sub: 'Telegram, WhatsApp, and Email conversations', icon: <InboxIcon size={18} />, iconBg: 'rgba(15,118,110,0.1)', iconColor: '#0F766E' },
                        { key: 'broadcasts', label: 'Broadcasts', sub: 'Send bulk messages across channels', icon: <Send size={18} />, iconBg: 'rgba(234,179,8,0.1)', iconColor: '#EAB308' },
                        { key: 'analytics', label: 'Analytics', sub: 'Dashboards and performance metrics', icon: <BarChart3 size={18} />, iconBg: 'rgba(59,130,246,0.1)', iconColor: '#3B82F6' },
                        { key: 'lead_tracker', label: 'Lead Tracker', sub: 'Track lead activity and engagement', icon: <Radar size={18} />, iconBg: 'rgba(139,92,246,0.1)', iconColor: '#8B5CF6' },
                        { key: 'templates', label: 'Templates', sub: 'Message templates for quick replies', icon: <FileTextIcon size={18} />, iconBg: 'rgba(245,158,11,0.1)', iconColor: '#F59E0B' },
                        { key: 'followups', label: 'Follow-Ups', sub: 'Scheduled reminders and follow-up tasks', icon: <Bell size={18} />, iconBg: 'rgba(239,68,68,0.1)', iconColor: '#EF4444' },
                        { key: 'automations', label: 'Automations', sub: 'Automated workflows and drip campaigns', icon: <Zap size={18} />, iconBg: 'rgba(245,158,11,0.1)', iconColor: '#F59E0B' },
                        { key: 'pipeline', label: 'Pipeline Funnel', sub: 'Visual lead pipeline funnel in sidebar', icon: <Filter size={18} />, iconBg: 'rgba(139,92,246,0.1)', iconColor: '#8B5CF6' },
                      ].map((item) => {
                        const isVisible = localSectionVis[item.key] !== false;
                        return (
                          <div key={item.key} className="appearance-toggle-row">
                            <div className="appearance-toggle-info">
                              <div className="appearance-toggle-icon" style={{ background: item.iconBg, color: item.iconColor }}>{item.icon}</div>
                              <div>
                                <span className="appearance-toggle-label">{item.label}</span>
                                <p className="appearance-toggle-sub">{item.sub}</p>
                              </div>
                            </div>
                            <button type="button"
                              onClick={() => setLocalSectionVis((prev) => ({ ...prev, [item.key]: !isVisible }))}
                              className="appearance-toggle-switch"
                              style={{ background: isVisible ? '#16a34a' : 'var(--text-dark)' }}
                              aria-label={`Toggle ${item.label}`}>
                              <span className="appearance-toggle-knob" style={{ left: isVisible ? '25px' : '3px' }} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="appearance-save-row" style={{ marginTop: '8px' }}>
                    <button type="button" onClick={handleSaveSectionVisibility} disabled={sectionVisSaving} className="appearance-save-btn">
                      {sectionVisSaving ? <Loader2 size={16} className="crm-spin" /> : <Save size={16} />} Save Section Visibility
                    </button>
                    {sectionVisSaved && (
                      <span className="appearance-saved-badge"><CheckCircle2 size={16} /> Saved!</span>
                    )}
                  </div>
                </>
              ) : activeTab === 'recycle_bin' ? (
                <>
                  <div className="crm-settings-card-header">
                    <h2 className="crm-settings-card-title"><Trash2 size={20} style={{ color: 'var(--text-dark)' }} /> Recycle Bin</h2>
                    <p className="crm-settings-card-desc">Deleted leads are stored here for 30 days. Restore them or permanently delete them.</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '24px', background: 'var(--bg-light)', borderRadius: '10px', border: '1px solid var(--border-subtle)', flexDirection: 'column' }}>
                    <Trash2 size={40} style={{ color: 'var(--text-dark)', opacity: 0.5 }} />
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-dark)', textAlign: 'center', maxWidth: '360px' }}>Click the button below to view, restore, or permanently delete your trashed leads.</p>
                    <button
                      type="button"
                      onClick={() => onOpenRecycleBin?.()}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', border: '1px solid var(--border-subtle)', borderRadius: '8px', background: 'var(--bg-card)', color: 'var(--text-dark)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#64748b'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#64748b'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.color = 'var(--text-dark)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                    >
                      <Trash2 size={16} /> Open Recycle Bin
                    </button>
                  </div>
                </>
              ) : activeTab === 'billing' ? (
                <BillingPlansSection session={session} />
              ) : activeTab === 'danger' ? (
                <DeleteAccountPanel session={session} onSignOut={onSignOut} />
              ) : null}

              {error && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '12px 16px', color: '#dc2626', fontSize: '0.85rem', fontWeight: 600, marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={16} /> {error}
                </div>
              )}

              {saved && (
                <div style={{ background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.3)', borderRadius: '8px', padding: '12px 16px', color: '#16a34a', fontSize: '0.85rem', fontWeight: 600, marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={16} /> Settings saved successfully.
                </div>
              )}

              <div className="crm-settings-footer">
                <button type="button" className="crm-add-lead-cancel" onClick={onBack} disabled={saving}>
                  Back to Dashboard
                </button>
                {activeTab !== 'team' && activeTab !== 'scheduled_emails' && activeTab !== 'danger' && activeTab !== 'recycle_bin' && activeTab !== 'lead_distribution' && activeTab !== 'pipeline_autoassign' && activeTab !== 'section_visibility' && activeTab !== 'pipeline_stages' && (
                  <button type="button" className="crm-add-lead-submit" onClick={handleSave} disabled={!canSave || saving || accountSaving}>
                    {(saving || accountSaving) ? <Loader2 size={18} className="crm-spin" /> : <Save size={18} />}
                    {(saving || accountSaving) ? 'Saving...' : 'Save Settings'}
                  </button>
                )}
              </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <CheckoutDrawer />
    </>
  );
}

// ===================== Chat Profile Panel =====================
function ChatProfilePanel({ convId, tableName, displayName, phoneNumber, profilePicUrl, lastMessageAt, onClose, onCallFromDrawer, stages }: {
  convId: string;
  tableName: 'chat_conversations' | 'wa_conversations';
  displayName: string;
  phoneNumber?: string | null;
  profilePicUrl: string | null;
  lastMessageAt: string | null;
  onClose: () => void;
  onCallFromDrawer?: (number: string) => void;
  stages: { key: LeadStatus; label: string; icon: React.ReactNode; color: string }[];
}) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [tagInput, setTagInput] = useState('');
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [fundInput, setFundInput] = useState('');
  const [product, setProduct] = useState<'algo' | 'tradingview_premium'>('algo');
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [reminderNote, setReminderNote] = useState('');
  const [savingReminder, setSavingReminder] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editState, setEditState] = useState('');
  const [editProduct, setEditProduct] = useState<'algo' | 'tradingview_premium'>('algo');
  const [savingInfo, setSavingInfo] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: conv } = await supabase
        .from(tableName)
        .select('lead_id')
        .eq('id', convId)
        .maybeSingle();

      let lid = (conv as { lead_id?: string | null } | null)?.lead_id ?? null;

      if (!lid) {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user.id;
        if (userId) {
          const { data: newLeadRow, error: insertError } = await supabase
            .from('submissions')
            .insert({
              full_name: displayName || 'Unknown',
              mobile_number: phoneNumber || 'N/A',
              email: 'N/A',
              state: 'N/A',
              trading_product: 'algo',
              status: 'new',
              tags: [],
              notes: '',
              fund_amount: null,
            })
            .select()
            .single();

          if (!insertError && newLeadRow) {
            lid = (newLeadRow as Lead).id;
            await supabase.from(tableName).update({ lead_id: lid }).eq('id', convId);
          }
        }
      }

      if (lid) {
        const { data: leadData } = await supabase
          .from('submissions')
          .select('*')
          .eq('id', lid)
          .maybeSingle();
        if (leadData) {
          const l = leadData as Lead;
          setLead(l);
          setNotesValue(l.notes || '');
          setFundInput(l.fund_amount != null ? String(l.fund_amount) : '');
          setProduct(l.trading_product);
          setEditName(l.full_name);
          setEditEmail(l.email);
          setEditMobile(l.mobile_number);
          setEditState(l.state);
          setEditProduct(l.trading_product);
        }
      }
      setLoading(false);
    })();
  }, [convId, tableName, displayName, phoneNumber]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('team_members')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: true });
      if (data) setTeamMembers(data as TeamMember[]);
    })();
  }, []);

  useEffect(() => {
    if (!lead) return;
    (async () => {
      setActivitiesLoading(true);
      const { data } = await supabase
        .from('lead_activities')
        .select('*')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) setActivities(data as LeadActivity[]);
      setActivitiesLoading(false);
    })();
  }, [lead]);

  useEffect(() => {
    if (!lead) return;
    (async () => {
      const { data } = await supabase
        .from('lead_followups')
        .select('*')
        .eq('lead_id', lead.id)
        .order('reminder_at', { ascending: true });
      if (data) setFollowups(data as FollowUp[]);
    })();
  }, [lead]);

  const logActivity = useCallback(async (activityType: string, description: string, metadata: Record<string, unknown> = {}) => {
    if (!lead) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) return;
    await supabase.from('lead_activities').insert({
      user_id: userId,
      lead_id: lead.id,
      activity_type: activityType,
      description,
      metadata,
    });
    setActivities((prev) => [{ id: crypto.randomUUID(), lead_id: lead.id, activity_type: activityType, description, metadata, created_at: new Date().toISOString() }, ...prev]);
  }, [lead]);

  const status = lead?.status || 'new';
  const stage = stages.find((s) => s.key === status)!;
  const colors = STAGE_COLORS[stage.color];
  const statusLabel = getLastSeenStatus(lastMessageAt);

  const updateLead = async (id: string, updates: Partial<Lead>) => {
    setLead((prev) => prev ? { ...prev, ...updates } : prev);
    await supabase.from('submissions').update(updates).eq('id', id);
  };

  const handleStatusChange = (newStatus: LeadStatus) => {
    if (!lead) return;
    const oldStatus = lead.status;
    updateLead(lead.id, { status: newStatus, last_contacted_at: new Date().toISOString() });
    if (oldStatus !== newStatus) {
      logActivity('status_change', `Status changed from "${oldStatus.replace(/_/g, ' ')}" to "${newStatus.replace(/_/g, ' ')}"`, { old_status: oldStatus, new_status: newStatus });
    }
  };

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed || !lead) return;
    const currentTags = lead.tags || [];
    if (currentTags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) return;
    updateLead(lead.id, { tags: [...currentTags, trimmed] });
    logActivity('tag_added', `Tag "${trimmed}" added`, { tag: trimmed });
    setTagInput('');
    setShowTagSuggestions(false);
  };

  const removeTag = (tag: string) => {
    if (!lead) return;
    updateLead(lead.id, { tags: (lead.tags || []).filter((t) => t !== tag) });
  };

  const saveNotes = () => {
    if (!lead) return;
    setSavingNotes(true);
    updateLead(lead.id, { notes: notesValue });
    logActivity('note', 'Notes updated', { note_preview: notesValue.slice(0, 100) });
    setSavingNotes(false);
  };

  const saveFund = () => {
    if (!lead) return;
    const parsed = parseFloat(fundInput);
    updateLead(lead.id, { fund_amount: isNaN(parsed) || parsed < 0 ? null : parsed });
  };

  const handleSaveInfo = () => {
    if (!lead) return;
    setSavingInfo(true);
    const updates: Partial<Lead> = {
      full_name: editName.trim() || lead.full_name,
      email: editEmail.trim() || lead.email,
      mobile_number: editMobile.trim() || lead.mobile_number,
      state: editState.trim() || lead.state,
      trading_product: editProduct,
    };
    updateLead(lead.id, updates);
    logActivity('lead_edit', `Lead info updated`, { fields: ['full_name', 'email', 'mobile_number', 'state', 'trading_product'] });
    setSavingInfo(false);
    setIsEditing(false);
  };

  const cancelEdit = () => {
    if (!lead) return;
    setEditName(lead.full_name);
    setEditEmail(lead.email);
    setEditMobile(lead.mobile_number);
    setEditState(lead.state);
    setEditProduct(lead.trading_product);
    setIsEditing(false);
  };

  const handleCreateReminder = async () => {
    if (!lead || !reminderDate || !reminderTime) return;
    const reminderAt = new Date(`${reminderDate}T${reminderTime}`).toISOString();
    setSavingReminder(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) { setSavingReminder(false); return; }

    const { data, error: insertError } = await supabase
      .from('lead_followups')
      .insert({
        user_id: userId,
        lead_id: lead.id,
        title: `Follow up: ${lead.full_name}`,
        note: reminderNote.trim() || null,
        reminder_at: reminderAt,
        status: 'pending',
      })
      .select()
      .single();

    if (!insertError && data) {
      setFollowups((prev) => [...prev, data as FollowUp].sort((a, b) => new Date(a.reminder_at).getTime() - new Date(b.reminder_at).getTime()));
      logActivity('follow_up_created', `Follow-up reminder set for ${reminderDate} at ${reminderTime}`, { reminder_at: reminderAt });
      setReminderDate('');
      setReminderTime('');
      setReminderNote('');
      setShowReminderForm(false);
    }
    setSavingReminder(false);
  };

  const handleDeleteReminder = async (id: string) => {
    await supabase.from('lead_followups').delete().eq('id', id);
    setFollowups((prev) => prev.filter((f) => f.id !== id));
  };

  const handleMarkReminderDone = async (id: string) => {
    await supabase.from('lead_followups').update({ status: 'done', updated_at: new Date().toISOString() }).eq('id', id);
    setFollowups((prev) => prev.map((f) => f.id === id ? { ...f, status: 'done' } : f));
    logActivity('follow_up_done', 'Follow-up reminder marked as done', { followup_id: id });
  };

  const availableSuggestions = SUGGESTED_TAGS.filter(
    (s) => !(lead?.tags || []).some((t) => t.toLowerCase() === s.toLowerCase())
  );

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <>
      <div className="crm-drawer-overlay" onClick={onClose} />
      <div className="crm-chat-profile-panel">
        <div className="crm-chat-profile-header">
          <div className="crm-chat-profile-header-info">
            <div className="crm-chat-profile-avatar-wrap">
              {profilePicUrl ? (
                <img src={profilePicUrl} alt="" className="crm-chat-profile-avatar-img" />
              ) : (
                <div className="crm-chat-profile-avatar-fallback">
                  {(displayName?.[0] || '?').toUpperCase()}
                </div>
              )}
              <span className={`crm-chat-profile-status-dot ${statusLabel.online ? 'online' : 'offline'}`} />
            </div>
            <div>
              <h2>{lead?.full_name || displayName}</h2>
              <p className="crm-chat-profile-status-text">
                {phoneNumber && <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{phoneNumber}</span>}
                {phoneNumber && ' · '}
                {statusLabel.label}
              </p>
            </div>
          </div>
          <button className="crm-drawer-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <Loader2 size={28} className="crm-spin" style={{ color: '#0088cc' }} />
          </div>
        ) : lead ? (
          <>
            {/* Current Status */}
            <div className="crm-drawer-section">
              <label className="crm-drawer-label">CURRENT STATUS</label>
              <span className="crm-status-badge crm-status-lg" style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}>
                {stage.icon} {stage.label}
              </span>
            </div>

            {/* Move to Stage */}
            <div className="crm-drawer-section">
              <label className="crm-drawer-label">MOVE TO STAGE</label>
              <div className="crm-status-grid">
                {stages.map((s) => {
                  const sc = STAGE_COLORS[s.color];
                  const isActive = status === s.key;
                  return (
                    <button
                      key={s.key}
                      className={`crm-status-btn ${isActive ? 'crm-status-btn-active' : ''}`}
                      style={isActive ? { background: sc.bg, borderColor: sc.dot, color: sc.text } : {}}
                      onClick={() => handleStatusChange(s.key)}
                    >
                      {s.icon} {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Contact Info */}
            <div className="crm-drawer-section">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label className="crm-drawer-label" style={{ marginBottom: 0 }}>CONTACT</label>
                {isEditing ? (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={cancelEdit} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', border: '1px solid var(--border-subtle)', borderRadius: '6px', background: 'var(--bg-card)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dark)', cursor: 'pointer' }}>
                      <X size={13} /> Cancel
                    </button>
                    <button onClick={handleSaveInfo} disabled={savingInfo} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', border: 'none', borderRadius: '6px', background: '#2563eb', fontSize: '0.75rem', fontWeight: 600, color: 'var(--bg-card)', cursor: 'pointer' }}>
                      {savingInfo ? <Loader2 size={13} className="crm-spin" /> : <Save size={13} />} Save
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setIsEditing(true)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', border: '1px solid var(--border-subtle)', borderRadius: '6px', background: 'var(--bg-light)', fontSize: '0.75rem', fontWeight: 600, color: '#2563eb', cursor: 'pointer', transition: 'all 0.15s' }} onMouseEnter={(e) => { e.currentTarget.style.background = '#2563eb'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-light)'; e.currentTarget.style.color = '#2563eb'; }}>
                    <Edit3 size={13} /> Edit Info
                  </button>
                )}
              </div>
              {isEditing ? (
                <div className="crm-add-lead-grid">
                  <label className="crm-add-lead-field">
                    <span>Full Name</span>
                    <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Full name" />
                  </label>
                  <label className="crm-add-lead-field">
                    <span>Mobile Number</span>
                    <input type="tel" value={editMobile} onChange={(e) => setEditMobile(e.target.value)} placeholder="Phone number" />
                  </label>
                  <label className="crm-add-lead-field">
                    <span>Email</span>
                    <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="Email address" />
                  </label>
                  <label className="crm-add-lead-field">
                    <span>State</span>
                    <input type="text" value={editState} onChange={(e) => setEditState(e.target.value)} placeholder="State" />
                  </label>
                  <label className="crm-add-lead-field">
                    <span>Trading Product</span>
                    <select value={editProduct} onChange={(e) => setEditProduct(e.target.value as 'algo' | 'tradingview_premium')} style={{ cursor: 'pointer' }}>
                      <option value="algo">Trading Algo</option>
                      <option value="tradingview_premium">TradingView Premium Indicator</option>
                    </select>
                  </label>
                </div>
              ) : (
                <div className="crm-drawer-contacts">
                  {lead.mobile_number && lead.mobile_number !== 'N/A' && (
                    <button type="button" className="crm-drawer-contact-item" onClick={() => onCallFromDrawer?.(lead.mobile_number)} style={{ cursor: 'pointer', font: 'inherit' }}>
                      <Phone size={16} /> <span>{lead.mobile_number}</span>
                    </button>
                  )}
                  {lead.email && lead.email !== 'N/A' && (
                    <a href={`mailto:${lead.email}`} className="crm-drawer-contact-item">
                      <Mail size={16} /> <span>{lead.email}</span>
                    </a>
                  )}
                  {lead.state && lead.state !== 'N/A' && (
                    <div className="crm-drawer-contact-item crm-contact-static">
                      <MapPin size={16} /> <span>{lead.state}</span>
                    </div>
                  )}
                  <div className="crm-drawer-contact-item crm-contact-static">
                    {product === 'algo' ? <Bot size={16} /> : <BarChart3 size={16} />}
                    <select
                      value={product}
                      onChange={(e) => {
                        const val = e.target.value as 'algo' | 'tradingview_premium';
                        setProduct(val);
                        updateLead(lead.id, { trading_product: val });
                      }}
                      aria-label="Trading product"
                      style={{ flex: 1, border: 0, background: 'transparent', color: 'var(--text-muted)', font: 'inherit', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
                    >
                      <option value="algo">Trading Algo</option>
                      <option value="tradingview_premium">TradingView Premium Indicator</option>
                    </select>
                  </div>
                  <div className="crm-drawer-contact-item crm-contact-static">
                    <DollarSign size={16} style={{ color: '#16a34a' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                      <input
                        type="number"
                        min="0"
                        step="50"
                        value={fundInput}
                        onChange={(e) => setFundInput(e.target.value)}
                        onBlur={saveFund}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        placeholder="0"
                        aria-label="Fund amount"
                        style={{ width: '120px', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '4px 8px', font: 'inherit', fontWeight: 700, color: '#16a34a', outline: 'none' }}
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>USD</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Assigned To */}
            <div className="crm-drawer-section">
              <label className="crm-drawer-label">ASSIGNED TO</label>
              <div className="crm-drawer-contact-item crm-contact-static">
                <Shuffle size={16} style={{ color: '#0f766e' }} />
                <select
                  value={lead.assigned_to || ''}
                  onChange={(e) => updateLead(lead.id, { assigned_to: e.target.value || null })}
                  aria-label="Assigned to"
                  style={{ flex: 1, border: 0, background: 'transparent', color: 'var(--text-muted)', font: 'inherit', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
                >
                  <option value="">Unassigned</option>
                  {teamMembers.map((m) => (
                    <option key={m.id} value={m.id}>{m.full_name || m.email}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tags */}
            <div className="crm-drawer-section">
              <label className="crm-drawer-label">TAGS</label>
              <div className="crm-tags-container">
                {(lead.tags || []).map((tag) => (
                  <span key={tag} className="crm-tag-chip">
                    <Tag size={11} /> {tag}
                    <button onClick={() => removeTag(tag)} aria-label={`Remove ${tag}`}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
                {(lead.tags || []).length === 0 && (
                  <span className="crm-tag-empty">No tags yet</span>
                )}
              </div>
              <div className="crm-tag-input-wrap">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); } }}
                  onFocus={() => setShowTagSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowTagSuggestions(false), 150)}
                  placeholder="Add a tag and press Enter..."
                />
                <button onClick={() => addTag(tagInput)} disabled={!tagInput.trim()} aria-label="Add tag">
                  <Plus size={18} />
                </button>
              </div>
              {showTagSuggestions && availableSuggestions.length > 0 && (
                <div className="crm-tag-suggestions">
                  {availableSuggestions.map((s) => (
                    <button key={s} className="crm-tag-suggestion" onClick={() => addTag(s)}>
                      <Plus size={12} /> {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="crm-drawer-section">
              <label className="crm-drawer-label">NOTES</label>
              <textarea
                className="crm-notes-textarea"
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                placeholder="Write notes about this prospect..."
                rows={4}
              />
              <button className="crm-btn-save-notes" onClick={saveNotes} disabled={savingNotes || notesValue === lead.notes}>
                <CheckCircle2 size={16} /> {savingNotes ? 'Saving...' : 'Save Notes'}
              </button>
            </div>

            {/* Last Contacted */}
            {lead.last_contacted_at && (
              <div className="crm-drawer-section">
                <label className="crm-drawer-label">LAST CONTACTED</label>
                <span className="crm-date-tag">
                  <Clock size={14} /> {formatDate(lead.last_contacted_at)}
                </span>
              </div>
            )}

            {/* Follow-up Reminders */}
            <div className="crm-drawer-section">
              <label className="crm-drawer-label">FOLLOW-UP REMINDERS</label>

              {followups.length > 0 && (
                <div className="crm-reminder-list">
                  {followups.map((f) => {
                    const isOverdue = f.status === 'pending' && new Date(f.reminder_at).getTime() < Date.now();
                    const isSent = f.status === 'sent';
                    const isDone = f.status === 'done';
                    return (
                      <div key={f.id} className={`crm-reminder-item ${isOverdue ? 'crm-reminder-overdue' : ''} ${isDone ? 'crm-reminder-done' : ''}`}>
                        <div className="crm-reminder-icon-wrap">
                          {isSent ? <BellRing size={16} style={{ color: '#0088cc' }} /> :
                           isDone ? <CheckCircle2 size={16} style={{ color: '#22c55e' }} /> :
                           isOverdue ? <BellRing size={16} style={{ color: '#ef4444' }} /> :
                           <Bell size={16} style={{ color: '#f59e0b' }} />}
                        </div>
                        <div className="crm-reminder-content">
                          <span className="crm-reminder-date">{formatDate(f.reminder_at)} at {new Date(f.reminder_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                          {f.note && <span className="crm-reminder-note">{f.note}</span>}
                          <span className={`crm-reminder-badge ${isOverdue ? 'crm-badge-overdue' : ''} ${isSent ? 'crm-badge-sent' : ''} ${isDone ? 'crm-badge-done' : ''}`}>
                            {isOverdue ? 'Overdue - Email sent' : isSent ? 'Email sent' : isDone ? 'Done' : 'Pending'}
                          </span>
                        </div>
                        {!isDone && (
                          <button className="crm-reminder-done-btn" onClick={() => handleMarkReminderDone(f.id)} aria-label="Mark done" title="Mark as done">
                            <CheckCircle2 size={16} />
                          </button>
                        )}
                        <button className="crm-reminder-del-btn" onClick={() => handleDeleteReminder(f.id)} aria-label="Delete reminder">
                          <X size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {showReminderForm ? (
                <div className="crm-reminder-form">
                  <div className="crm-reminder-form-row">
                    <input
                      type="date"
                      value={reminderDate}
                      onChange={(e) => setReminderDate(e.target.value)}
                      className="crm-reminder-input"
                      aria-label="Reminder date"
                    />
                    <input
                      type="time"
                      value={reminderTime}
                      onChange={(e) => setReminderTime(e.target.value)}
                      className="crm-reminder-input"
                      aria-label="Reminder time"
                    />
                  </div>
                  <input
                    type="text"
                    value={reminderNote}
                    onChange={(e) => setReminderNote(e.target.value)}
                    placeholder="What to follow up about? (optional)"
                    className="crm-reminder-note-input"
                  />
                  <div className="crm-reminder-form-actions">
                    <button className="crm-reminder-cancel-btn" onClick={() => setShowReminderForm(false)}>Cancel</button>
                    <button className="crm-reminder-save-btn" onClick={handleCreateReminder} disabled={!reminderDate || !reminderTime || savingReminder}>
                      {savingReminder ? <Loader2 size={16} className="crm-spin" /> : <CalendarClock size={16} />}
                      {savingReminder ? 'Setting...' : 'Set Reminder'}
                    </button>
                  </div>
                </div>
              ) : (
                <button className="crm-reminder-add-btn" onClick={() => setShowReminderForm(true)}>
                  <CalendarClock size={18} /> Set Follow-up Reminder
                </button>
              )}
              <p className="crm-reminder-hint">You'll get an email alert at your configured email address when the reminder is due.</p>
            </div>

            {/* Quick Actions */}
            <div className="crm-drawer-section">
              <label className="crm-drawer-label">QUICK ACTIONS</label>
              <div className="crm-quick-actions">
                {lead.mobile_number && lead.mobile_number !== 'N/A' && (
                  <button type="button" className="crm-quick-btn crm-quick-call" onClick={() => onCallFromDrawer?.(lead.mobile_number)} style={{ cursor: 'pointer' }}>
                    <PhoneCall size={18} /> Call
                  </button>
                )}
                {lead.mobile_number && lead.mobile_number !== 'N/A' && (
                  <a href={`https://wa.me/${lead.mobile_number.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="crm-quick-btn crm-quick-wa">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.978-1.207zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413z"/>
                    </svg>
                    WhatsApp
                  </a>
                )}
                {lead.email && lead.email !== 'N/A' && (
                  <a href={`mailto:${lead.email}`} className="crm-quick-btn crm-quick-email">
                    <Mail size={18} /> Email
                  </a>
                )}
              </div>
            </div>

            {/* Activity Timeline */}
            <div className="crm-drawer-section">
              <label className="crm-drawer-label"><History size={14} style={{ display: 'inline', marginRight: '4px' }} /> ACTIVITY TIMELINE</label>
              {activitiesLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', color: 'var(--text-dark)', fontSize: '0.82rem' }}>
                  <Loader2 size={16} className="crm-spin" /> Loading activities...
                </div>
              ) : activities.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-dark)', fontSize: '0.82rem' }}>
                  <History size={28} style={{ marginBottom: '6px', opacity: 0.3 }} />
                  <p>No activity recorded yet. Status changes, notes, tags, and follow-ups will appear here.</p>
                </div>
              ) : (
                <div className="crm-activity-timeline">
                  {activities.map((act, idx) => {
                    const iconMap: Record<string, React.ReactNode> = {
                      status_change: <Shuffle size={14} style={{ color: '#2563eb' }} />,
                      note: <StickyNote size={14} style={{ color: '#f59e0b' }} />,
                      email_sent: <Send size={14} style={{ color: '#6366f1' }} />,
                      telegram_message: <MessageCircle size={14} style={{ color: '#0088cc' }} />,
                      whatsapp_message: <MessageSquare size={14} style={{ color: '#25D366' }} />,
                      follow_up_created: <Bell size={14} style={{ color: '#f59e0b' }} />,
                      follow_up_done: <CheckCircle2 size={14} style={{ color: '#22c55e' }} />,
                      lead_created: <Plus size={14} style={{ color: '#16a34a' }} />,
                      tag_added: <Tag size={14} style={{ color: '#8b5cf6' }} />,
                      tag_removed: <Tag size={14} style={{ color: '#ef4444' }} />,
                      call: <PhoneCall size={14} style={{ color: '#0891b2' }} />,
                      assignment: <Shuffle size={14} style={{ color: '#0f766e' }} />,
                    };
                    return (
                      <div key={act.id} className="crm-activity-item">
                        {idx < activities.length - 1 && <div className="crm-activity-line" />}
                        <div className="crm-activity-dot">
                          {iconMap[act.activity_type] || <History size={14} style={{ color: 'var(--text-dark)' }} />}
                        </div>
                        <div className="crm-activity-body">
                          <span className="crm-activity-desc">{act.description}</span>
                          <span className="crm-activity-time">
                            {new Date(act.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at{' '}
                            {new Date(act.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <Loader2 size={24} className="crm-spin" style={{ color: 'var(--text-dark)' }} />
            <p style={{ marginTop: '12px', fontSize: '0.85rem', color: 'var(--text-dark)' }}>Setting up lead profile...</p>
          </div>
        )}
      </div>
    </>
  );
}

// ===================== Chat Inbox =====================
function ChatInbox({ session, onUnreadChange, refreshKey, onRefresh, onCall }: {
  session: Session;
  onUnreadChange: (count: number) => void;
  refreshKey: number;
  onRefresh: () => void;
  onCall?: (number: string) => void;
}) {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [botConfigured, setBotConfigured] = useState<boolean | null>(null);
  const [mediaCache, setMediaCache] = useState<Record<string, string>>({});
  const [selectedConvIds, setSelectedConvIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [deletingConv, setDeletingConv] = useState<string | null>(null);
  const [bulkDeletingConvs, setBulkDeletingConvs] = useState(false);
  const [showConvDeleteConfirm, setShowConvDeleteConfirm] = useState<string | null>(null);
  const [showBulkConvDeleteConfirm, setShowBulkConvDeleteConfirm] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const [botFilter, setBotFilter] = useState<string>('all');
  const [botLabels, setBotLabels] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const EMOJI_LIST = ['😀', '😂', '😍', '😎', '🤔', '😢', '😡', '👍', '👎', '❤️', '🔥', '🎉', '👏', '🙏', '💯', '✅', '❌', '⭐', '💰', '📈', '📉', '🚀', '💡', '🎯', '✨', '💪', '🤝', '👋', '😅', '🥳', '😇', '🤩', '🙄', '😤', '🤯', '🥺', '😱', '🤗', '🤫', '🤥', '😴', '🤤', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👻', '💀', '🤖', '🎃', '😺', '😸', '😻', '😼', '😽', '🙀', '😿', '😾', '🙌', '👐', '🤲', '🤟', '🤘', '🤙', '👌', '🤌', '🤏', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐️', '🖖', '👋', '🤝', '✍️', '💪', '🦾', '🦿', '👀', '👁️', '👅', '👄', '🦷', '🧠', '🦴', ' skeleton', '🦵', '🦶', '👂', '🫀', '🫁', '🧠', '🦷', '🦴', '👀', '👁️', '👅', '👄', '🧒', '👦', '👧', '🧑', '👨', '👩', '🧓', '👴', '👵', '🧔', '🧕', '👱', '👱‍♂️', '👱‍♀️', '👨‍🦰', '👩‍🦰', '👨‍🦱', '👩‍🦱', '👨‍🦳', '👩‍🦳', '👨‍🦲', '👩‍🦲', '👨‍🦳', '👩‍🦳', '🧓', '👴', '👵', '🧓', '👴', '👵'];

  const fetchConversations = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('chat_conversations')
      .select('*')
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (fetchError) return;
    setConversations((data || []) as ChatConversation[]);
    const totalUnread = (data || []).reduce((sum, c) => sum + c.unread_count, 0);
    onUnreadChange(totalUnread);
    setLoading(false);
  }, [onUnreadChange]);

  const deleteConversation = useCallback(async (id: string) => {
    setDeletingConv(id);
    const { error: delError } = await supabase
      .from('chat_conversations')
      .delete()
      .eq('id', id);
    setDeletingConv(null);
    if (delError) {
      setError('Failed to delete conversation.');
      return;
    }
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (selectedConv === id) setSelectedConv(null);
    setSelectedConvIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    fetchConversations();
  }, [selectedConv, fetchConversations]);

  const bulkDeleteConversations = useCallback(async (ids: string[]) => {
    setBulkDeletingConvs(true);
    const { error: delError } = await supabase
      .from('chat_conversations')
      .delete()
      .in('id', ids);
    setBulkDeletingConvs(false);
    if (delError) {
      setError('Failed to delete conversations.');
      return;
    }
    setConversations((prev) => prev.filter((c) => !ids.includes(c.id)));
    if (selectedConv && ids.includes(selectedConv)) setSelectedConv(null);
    setSelectedConvIds(new Set());
    setShowBulkConvDeleteConfirm(false);
    setSelectMode(false);
    fetchConversations();
  }, [selectedConv, fetchConversations]);

  const toggleConvSelect = (id: string) => {
    setSelectedConvIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleSelectAllConvs = () => {
    if (selectedConvIds.size === conversations.length) {
      setSelectedConvIds(new Set());
    } else {
      setSelectedConvIds(new Set(conversations.map((c) => c.id)));
    }
  };

  useEffect(() => {
    fetchConversations();
    (async () => {
      const { data: tgData } = await supabase.from('telegram_settings').select('bot_token').maybeSingle();
      setBotConfigured(Boolean(tgData?.bot_token));
      const { data: botsData } = await supabase.from('telegram_bots').select('id,label').order('created_at', { ascending: true });
      if (botsData) {
        const map: Record<string, string> = {};
        for (const b of botsData as { id: string; label: string }[]) map[b.id] = b.label;
        setBotLabels(map);
      }
    })();
  }, [fetchConversations, refreshKey]);

  useEffect(() => {
    if (!selectedConv) return;
    setLoadingMessages(true);
    (async () => {
      const { data, error: fetchError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', selectedConv)
        .order('created_at', { ascending: true });

      if (!fetchError && data) {
        setMessages(data as ChatMessage[]);
      }
      setLoadingMessages(false);

      await supabase
        .from('chat_conversations')
        .update({ unread_count: 0 })
        .eq('id', selectedConv);
    })();
  }, [selectedConv]);

  // Real-time: subscribe to new messages in the selected conversation
  useEffect(() => {
    if (!selectedConv) return;
    const channel = supabase
      .channel(`chat_messages:${selectedConv}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${selectedConv}` },
        (payload) => {
          setMessages((prev) => {
            const newMsg = payload.new as ChatMessage;
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        },
      )
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED' && status !== 'TIMED_OUT' && status !== 'CHANNEL_ERROR') {
          console.warn('[Telegram msg realtime] status:', status);
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [selectedConv]);

  // Real-time: subscribe to conversation list updates
  useEffect(() => {
    const channel = supabase
      .channel('chat_conversations_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_conversations' },
        () => { fetchConversations(); },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        () => { fetchConversations(); },
      )
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED' && status !== 'TIMED_OUT' && status !== 'CHANNEL_ERROR') {
          console.warn('[Telegram realtime] status:', status);
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [fetchConversations]);

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedConv || sending) return;
    setSending(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-telegram-message`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ conversationId: selectedConv, text: replyText.trim() }),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        setMessages((prev) => [...prev, result.message as ChatMessage]);
        setReplyText('');
        fetchConversations();
      } else {
        setError(result.error || 'Failed to send message');
      }
    } catch {
      setError('Network error');
    }
    setSending(false);
  };

  const handleFileUpload = async () => {
    if (!pendingFile || !selectedConv || uploading) return;
    setUploading(true);
    setError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;

      const formData = new FormData();
      formData.append('conversationId', selectedConv);
      formData.append('caption', replyText.trim());
      formData.append('file', pendingFile);

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-telegram-message`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const result = await response.json();
      if (response.ok && result.success) {
        setMessages((prev) => [...prev, result.message as ChatMessage]);
        setReplyText('');
        setPendingFile(null);
        fetchConversations();
      } else {
        setError(result.error || 'Failed to upload file');
      }
    } catch {
      setError('Network error');
    }
    setUploading(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        setError('File too large. Maximum 50MB.');
        return;
      }
      setPendingFile(file);
      setError('');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const insertEmoji = (emoji: string) => {
    setReplyText((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Prefer OGG if the browser supports it (Telegram sendVoice requires OGG/Opus)
      const mimeOptions = [
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/webm;codecs=opus',
        'audio/webm',
      ];
      let mimeType = '';
      for (const m of mimeOptions) {
        if (MediaRecorder.isTypeSupported(m)) { mimeType = m; break; }
      }
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      const actualMime = recorder.mimeType || mimeType || 'audio/webm';
      const ext = actualMime.includes('ogg') ? 'ogg' : 'webm';
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: actualMime });
        if (blob.size === 0) return;
        if (actualMime.includes('ogg')) {
          const file = new File([blob], `voice-${Date.now()}.ogg`, { type: actualMime });
          setPendingFile(file);
        } else {
          try {
            const wavBlob = await convertToWav(blob);
            const file = new File([wavBlob], `voice-${Date.now()}.wav`, { type: 'audio/wav' });
            setPendingFile(file);
          } catch {
            const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: actualMime });
            setPendingFile(file);
          }
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordDuration(0);
      recordTimerRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    } catch {
      setError('Microphone access denied or unavailable');
    }
  };

  const stopRecording = (cancel: boolean = false) => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      if (cancel) {
        recorder.ondataavailable = null;
        recorder.onstop = () => {
          if (recorder.stream) recorder.stream.getTracks().forEach((t) => t.stop());
        };
      }
      recorder.stop();
    }
    mediaRecorderRef.current = null;
    setIsRecording(false);
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setRecordDuration(0);
  };

  const sendVoiceMessage = async () => {
    if (!pendingFile || !selectedConv || uploading) return;
    setUploading(true);
    setError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;

      const formData = new FormData();
      formData.append('conversationId', selectedConv);
      formData.append('caption', '');
      formData.append('isVoice', 'true');
      formData.append('file', pendingFile);

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-telegram-message`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const result = await response.json();
      if (response.ok && result.success) {
        setMessages((prev) => [...prev, result.message as ChatMessage]);
        setPendingFile(null);
        fetchConversations();
      } else {
        setError(result.error || 'Failed to send voice message');
      }
    } catch {
      setError('Network error');
    }
    setUploading(false);
  };

  const [error, setError] = useState('');

  const getMediaUrl = useCallback((msg: ChatMessage): string | null => {
    if (!msg.file_id) return null;
    if (mediaCache[msg.id]) return mediaCache[msg.id];
    const fetchUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-file?file_id=${encodeURIComponent(msg.file_id)}&message_id=${msg.id}`;
    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) return;
        const res = await fetch(fetchUrl, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const blob = await res.blob();
        const objUrl = URL.createObjectURL(blob);
        setMediaCache((prev) => ({ ...prev, [msg.id]: objUrl }));
      } catch {
        // ignore
      }
    })();
    return null;
  }, [mediaCache]);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024).toFixed(1))} MB`;
  };

  const renderTextWithLinks = (text: string, isAdmin: boolean = false) => {
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
      if (urlRegex.test(part)) {
        return (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: isAdmin ? '#bfdbfe' : '#2563eb', textDecoration: 'underline', wordBreak: 'break-all' }}>
            {part}
          </a>
        );
      }
      return part;
    });
  };

  const renderMessageContent = (msg: ChatMessage) => {
    switch (msg.message_type) {
      case 'text':
        return <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{renderTextWithLinks(msg.text_content || '', msg.sender === 'admin')}</div>;

      case 'photo': {
        const url = getMediaUrl(msg);
        return (
          <div>
            {url ? (
              <img src={url} alt="Photo" style={{ maxWidth: '280px', borderRadius: '8px', display: 'block', marginBottom: msg.text_content ? '6px' : 0 }} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', minWidth: '200px' }}>
                <Loader2 size={18} className="crm-spin" />
                <span style={{ fontSize: '0.8rem' }}>Loading photo...</span>
              </div>
            )}
            {msg.text_content && <div style={{ whiteSpace: 'pre-wrap' }}>{renderTextWithLinks(msg.text_content, msg.sender === 'admin')}</div>}
          </div>
        );
      }

      case 'video': {
        const url = getMediaUrl(msg);
        return (
          <div>
            {url ? (
              <video controls style={{ maxWidth: '280px', borderRadius: '8px', display: 'block', marginBottom: msg.text_content ? '6px' : 0 }}>
                <source src={url} />
              </video>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', minWidth: '200px' }}>
                <Loader2 size={18} className="crm-spin" />
                <span style={{ fontSize: '0.8rem' }}>Loading video...</span>
              </div>
            )}
            {msg.text_content && <div style={{ whiteSpace: 'pre-wrap' }}>{renderTextWithLinks(msg.text_content, msg.sender === 'admin')}</div>}
          </div>
        );
      }

      case 'animation': {
        const url = getMediaUrl(msg);
        return (
          <div>
            {url ? (
              <video autoPlay loop muted style={{ maxWidth: '280px', borderRadius: '8px', display: 'block', marginBottom: msg.text_content ? '6px' : 0 }}><source src={url} /></video>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', minWidth: '200px' }}>
                <Loader2 size={18} className="crm-spin" />
                <span style={{ fontSize: '0.8rem' }}>Loading GIF...</span>
              </div>
            )}
            {msg.text_content && <div style={{ whiteSpace: 'pre-wrap' }}>{renderTextWithLinks(msg.text_content, msg.sender === 'admin')}</div>}
          </div>
        );
      }

      case 'voice':
      case 'audio': {
        const url = getMediaUrl(msg);
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '200px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: msg.sender === 'client' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Mic size={18} />
              </div>
              <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>{msg.message_type === 'voice' ? 'Voice message' : 'Audio'}</span>
              {msg.media_duration && <span style={{ fontSize: '0.72rem', opacity: 0.7 }}>{formatDuration(msg.media_duration)}</span>}
            </div>
            {url ? <audio controls style={{ width: '100%' }}><source src={url} /></audio> : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', opacity: 0.7 }}>
                <Loader2 size={14} className="crm-spin" /> Loading audio...
              </div>
            )}
            {msg.text_content && <div style={{ whiteSpace: 'pre-wrap' }}>{renderTextWithLinks(msg.text_content, msg.sender === 'admin')}</div>}
          </div>
        );
      }

      case 'document': {
        const url = getMediaUrl(msg);
        return (
          <a href={url || '#'} target="_blank" rel="noopener noreferrer" download={msg.file_name || undefined} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', textDecoration: 'none', color: 'inherit', minWidth: '200px', opacity: url ? 1 : 0.5, pointerEvents: url ? 'auto' : 'none' }}>
            <FileIcon size={24} />
            <div>
              <strong style={{ fontSize: '0.82rem', display: 'block' }}>{msg.file_name || 'Document'}</strong>
              {msg.file_size && <span style={{ fontSize: '0.72rem', opacity: 0.7 }}>{formatFileSize(msg.file_size)}</span>}
            </div>
          </a>
        );
      }

      case 'sticker':
        return <div style={{ fontSize: '3rem', lineHeight: 1 }}>{msg.emoji || '🏷️'}</div>;

      case 'location':
        return (
          <a href={`https://maps.google.com/?q=${msg.latitude},${msg.longitude}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', textDecoration: 'none', color: 'inherit' }}>
            <MapPin size={20} />
            <span style={{ fontSize: '0.82rem' }}>Location: {msg.latitude?.toFixed(4)}, {msg.longitude?.toFixed(4)}</span>
          </a>
        );

      default:
        return <div>{msg.text_content || 'Unsupported message type'}</div>;
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px', padding: '20px' }}>
        <Loader2 size={32} className="crm-spin" style={{ color: '#2563eb' }} />
      </div>
    );
  }

  if (botConfigured === false) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', textAlign: 'center', padding: '24px' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'linear-gradient(135deg, #0088cc, #00a3e0)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
          <MessageCircle size={32} style={{ color: 'var(--bg-card)' }} />
        </div>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px' }}>Telegram Bot Not Configured</h2>
        <p style={{ color: 'var(--text-dark)', fontSize: '0.88rem', maxWidth: '400px', lineHeight: 1.6, marginBottom: '20px' }}>
          To use the client chat inbox, you need to configure your Telegram bot in Settings. Create a bot via @BotFather on Telegram, then add the bot token in Settings.
        </p>
      </div>
    );
  }

  const selectedConversation = conversations.find((c) => c.id === selectedConv);

  return (
    <div className="crm-chat-container tg-theme">
      {/* Conversation List */}
      <div className={`crm-chat-list ${selectedConv ? 'hidden-mobile' : ''}`}>
        <div className="crm-chat-list-header">
          <div className="crm-chat-list-heading">
            <h2>Telegram Inbox</h2>
            <span>{conversations.length} conversations</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              className="crm-chat-refresh"
              onClick={() => { setSelectMode((v) => !v); setSelectedConvIds(new Set()); }}
              aria-label={selectMode ? 'Cancel selection' : 'Select conversations'}
              style={selectMode ? { background: '#0088cc', color: 'var(--bg-card)', borderColor: '#0088cc' } : undefined}
            >
              {selectMode ? <X size={16} /> : <CheckSquare size={16} />}
            </button>
            <button className="crm-chat-refresh" onClick={() => { fetchConversations(); onRefresh(); }} aria-label="Refresh">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
        {selectMode && conversations.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid #b8e1f5', background: 'rgba(0,136,204,0.04)' }}>
            <button
              onClick={toggleSelectAllConvs}
              style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0088cc', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {selectedConvIds.size === conversations.length ? <CheckSquare size={15} /> : <Square size={15} />}
              {selectedConvIds.size === conversations.length ? 'Deselect all' : 'Select all'}
            </button>
            <span style={{ fontSize: '0.78rem', color: '#006699', fontWeight: 600 }}>
              {selectedConvIds.size} selected
            </span>
            {selectedConvIds.size > 0 && (
              <button
                onClick={() => setShowBulkConvDeleteConfirm(true)}
                disabled={bulkDeletingConvs}
                style={{ fontSize: '0.8rem', fontWeight: 600, color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Trash2 size={15} /> Delete
              </button>
            )}
          </div>
        )}
        <div className="crm-chat-search">
          <Search size={16} />
          <input placeholder="Search conversations" aria-label="Search conversations" />
        </div>

        {Object.keys(botLabels).length > 0 && (
          <div style={{ padding: '0 16px 8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setBotFilter('all')}
              style={{ padding: '4px 10px', borderRadius: '6px', border: `1px solid ${botFilter === 'all' ? '#0088cc' : 'var(--border-subtle)'}`, background: botFilter === 'all' ? 'rgba(0,136,204,0.1)' : 'var(--bg-card)', color: botFilter === 'all' ? '#0088cc' : 'var(--text-dark)', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}
            >
              All Bots
            </button>
            {Object.entries(botLabels).map(([bid, blabel]) => (
              <button
                key={bid}
                onClick={() => setBotFilter(bid)}
                style={{ padding: '4px 10px', borderRadius: '6px', border: `1px solid ${botFilter === bid ? '#0088cc' : 'var(--border-subtle)'}`, background: botFilter === bid ? 'rgba(0,136,204,0.1)' : 'var(--bg-card)', color: botFilter === bid ? '#0088cc' : 'var(--text-dark)', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Bot size={11} /> {blabel}
              </button>
            ))}
          </div>
        )}

        <div className="crm-chat-list-body">
          {conversations.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-dark)' }}>
              <MessageCircle size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <p style={{ fontSize: '0.85rem' }}>No conversations yet. When clients message your Telegram bot, they'll appear here.</p>
            </div>
          ) : (
            conversations.filter((c) => botFilter === 'all' || c.bot_id === botFilter).map((conv) => (
              <div
                key={conv.id}
                className={`crm-chat-conv-item ${selectedConv === conv.id ? 'active' : ''}`}
                style={{ display: 'flex', alignItems: 'center', gap: selectMode ? '8px' : 0, padding: selectMode ? '12px 12px 12px 8px' : undefined }}
              >
                {selectMode && (
                  <button
                    onClick={() => toggleConvSelect(conv.id)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', flexShrink: 0 }}
                    aria-label="Select conversation"
                  >
                    {selectedConvIds.has(conv.id)
                      ? <CheckSquare size={20} style={{ color: '#0088cc' }} />
                      : <Square size={20} style={{ color: 'var(--text-dark)' }} />}
                  </button>
                )}
                <button
                  onClick={() => !selectMode && setSelectedConv(conv.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0, border: 'none', background: 'none', cursor: selectMode ? 'default' : 'pointer', padding: 0, textAlign: 'left' }}
                >
                  <div className="crm-chat-conv-avatar-wrap">
                    {conv.profile_pic_url ? (
                      <img src={conv.profile_pic_url} alt="" className="crm-chat-conv-avatar-img" />
                    ) : (
                      <div className="crm-chat-conv-avatar">
                        {(conv.telegram_first_name?.[0] || conv.telegram_username?.[0] || '?').toUpperCase()}
                      </div>
                    )}
                    <span className={`crm-chat-status-dot ${getLastSeenStatus(conv.last_message_at).online ? 'online' : 'offline'}`} />
                  </div>
                  <div className="crm-chat-conv-info">
                    <div className="crm-chat-conv-top">
                      <strong className="crm-chat-conv-name">
                        {conv.telegram_first_name || conv.telegram_username || 'Unknown'}
                      </strong>
                      {conv.bot_id && botLabels[conv.bot_id] && (
                        <span style={{ fontSize: '0.62rem', fontWeight: 600, color: '#0088cc', background: 'rgba(0,136,204,0.08)', padding: '1px 6px', borderRadius: '4px', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <Bot size={9} /> {botLabels[conv.bot_id]}
                        </span>
                      )}
                      {conv.last_message_at && (
                        <span className="crm-chat-conv-time">{formatTime(conv.last_message_at)}</span>
                      )}
                    </div>
                    <div className="crm-chat-conv-bottom">
                      <span className="crm-chat-conv-preview">
                        {conv.last_message_text || 'No messages'}
                      </span>
                      {conv.unread_count > 0 && (
                        <span className="crm-chat-unread-badge">{conv.unread_count}</span>
                      )}
                    </div>
                  </div>
                </button>
                {!selectMode && (
                  <button
                    onClick={() => setShowConvDeleteConfirm(conv.id)}
                    disabled={deletingConv === conv.id}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '8px', color: 'var(--text-dark)', flexShrink: 0, display: 'flex', alignItems: 'center' }}
                    aria-label="Delete conversation"
                  >
                    {deletingConv === conv.id ? <Loader2 size={16} className="crm-spin" /> : <Trash2 size={16} />}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Message Thread */}
      <div className={`crm-chat-thread ${selectedConv ? 'visible-mobile' : ''}`}>
        {!selectedConv ? (
          <div className="crm-chat-empty">
            <MessageCircle size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
            <p style={{ fontSize: '0.9rem' }}>Select a conversation to view messages</p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="crm-chat-header">
              <button className="crm-chat-back-btn" onClick={() => setSelectedConv(null)} aria-label="Back">
                <ArrowLeft size={20} />
              </button>
              <button className="crm-chat-header-profile-btn" onClick={() => setShowProfilePanel(true)} aria-label="View profile">
                <div className="crm-chat-header-avatar-wrap">
                  {selectedConversation?.profile_pic_url ? (
                    <img src={selectedConversation.profile_pic_url} alt="" className="crm-chat-header-avatar-img" />
                  ) : (
                    <div className="crm-chat-header-avatar">
                      {(selectedConversation?.telegram_first_name?.[0] || '?').toUpperCase()}
                    </div>
                  )}
                  <span className={`crm-chat-header-status-dot ${getLastSeenStatus(selectedConversation?.last_message_at || null).online ? 'online' : 'offline'}`} />
                </div>
                <div className="crm-chat-header-copy">
                  <strong>{selectedConversation?.telegram_first_name} {selectedConversation?.telegram_last_name}</strong>
                  <span className="crm-chat-status-text">
                    {getLastSeenStatus(selectedConversation?.last_message_at || null).label}
                  </span>
                </div>
              </button>
              <button className="crm-chat-header-action" aria-label="Conversation options"><MoreVertical size={18} /></button>
            </div>

            {/* Messages */}
            <div className="crm-chat-messages">
              <div className="crm-chat-date-sep"><span>Today</span></div>
              {loadingMessages ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                  <Loader2 size={24} className="crm-spin" style={{ color: '#0088cc' }} />
                </div>
              ) : messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-dark)', padding: '40px', fontSize: '0.85rem' }}>
                  No messages yet. Start the conversation by sending a reply below.
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} style={{
                    display: 'flex',
                    justifyContent: msg.sender === 'admin' ? 'flex-end' : 'flex-start',
                  }}>
                    <div className={`crm-chat-bubble ${msg.sender === 'admin' ? 'crm-chat-bubble-admin' : 'crm-chat-bubble-client'}`}>
                      {renderMessageContent(msg)}
                      <div className="crm-chat-bubble-time" style={{ textAlign: msg.sender === 'admin' ? 'right' : 'left' }}>
                        {formatTime(msg.created_at)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Reply Input */}
            <div className="crm-chat-reply-bar">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.txt,.zip"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              {pendingFile && (
                <div className="crm-chat-pending-file">
                  <div className="crm-chat-pending-icon">
                    {pendingFile.type.startsWith('image/') ? <ImageIcon size={18} /> :
                     pendingFile.type.startsWith('video/') ? <VideoIcon size={18} /> :
                     pendingFile.type.startsWith('audio/') ? <Mic size={18} /> :
                     <FileIcon size={18} />}
                  </div>
                  <div className="crm-chat-pending-info">
                    <strong>{pendingFile.name}</strong>
                    <span>{(pendingFile.size / 1024).toFixed(1)} KB</span>
                  </div>
                  <button
                    className="crm-chat-pending-remove"
                    onClick={() => setPendingFile(null)}
                    aria-label="Remove file"
                  >
                    <XIcon size={14} />
                  </button>
                </div>
              )}
              {showEmojiPicker && (
                <div className="crm-chat-emoji-picker">
                  <div className="crm-chat-emoji-grid">
                    {EMOJI_LIST.map((emoji, i) => (
                      <button
                        key={i}
                        className="crm-chat-emoji-btn"
                        onClick={() => insertEmoji(emoji)}
                        type="button"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {isRecording && (
                <div className="crm-chat-recording-bar">
                  <div className="crm-chat-recording-dot" />
                  <span className="crm-chat-recording-time">
                    {Math.floor(recordDuration / 60)}:{(recordDuration % 60).toString().padStart(2, '0')}
                  </span>
                  <span className="crm-chat-recording-label">Recording...</span>
                  <button
                    className="crm-chat-recording-cancel"
                    onClick={() => stopRecording(true)}
                    type="button"
                    aria-label="Cancel recording"
                  >
                    <XIcon size={16} /> Cancel
                  </button>
                  <button
                    className="crm-chat-recording-send"
                    onClick={() => { stopRecording(false); }}
                    type="button"
                    aria-label="Stop and send voice"
                    disabled={recordDuration < 1}
                  >
                    <Send size={16} /> Send
                  </button>
                </div>
              )}
              {pendingFile && pendingFile.type.startsWith('audio/') && (
                <div className="crm-chat-pending-file">
                  <div className="crm-chat-pending-icon">
                    <Mic size={18} />
                  </div>
                  <div className="crm-chat-pending-info">
                    <strong>Voice message</strong>
                    <span>{(pendingFile.size / 1024).toFixed(1)} KB</span>
                  </div>
                  <button
                    className="crm-chat-pending-remove"
                    onClick={() => setPendingFile(null)}
                    aria-label="Remove file"
                  >
                    <XIcon size={14} />
                  </button>
                  <button
                    className="crm-chat-recording-send"
                    onClick={sendVoiceMessage}
                    disabled={uploading}
                    type="button"
                  >
                    {uploading ? <Loader2 size={16} className="crm-spin" /> : <Send size={16} />} Send
                  </button>
                </div>
              )}
              <div className="crm-chat-reply-row">
                <button
                  className="crm-chat-attach-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || sending || isRecording}
                  aria-label="Attach file"
                  type="button"
                >
                  <Paperclip size={20} />
                </button>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
                  placeholder={isRecording ? 'Recording voice message...' : 'Type your reply...'}
                  rows={1}
                  className="crm-chat-reply-input"
                  disabled={isRecording}
                />
                <button
                  className={`crm-chat-mic-btn ${isRecording ? 'recording' : ''}`}
                  onClick={isRecording ? () => stopRecording(false) : startRecording}
                  disabled={uploading || sending || (pendingFile != null && !pendingFile.type.startsWith('audio/'))}
                  aria-label={isRecording ? 'Stop recording' : 'Record voice message'}
                  type="button"
                >
                  {isRecording ? <Loader2 size={20} className="crm-spin" /> : <Mic size={20} />}
                </button>
                <button
                  className="crm-chat-emoji-toggle"
                  onClick={() => setShowEmojiPicker((v) => !v)}
                  disabled={isRecording}
                  aria-label="Emoji picker"
                  type="button"
                >
                  <Smile size={20} />
                </button>
                <button
                  onClick={pendingFile ? (pendingFile.type.startsWith('audio/') ? sendVoiceMessage : handleFileUpload) : handleSendReply}
                  disabled={pendingFile ? uploading : (!replyText.trim() || sending)}
                  className="crm-chat-send-btn"
                  aria-label="Send"
                >
                  {uploading || sending ? <Loader2 size={18} className="crm-spin" /> : <Send size={18} />}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Single delete confirmation */}
      {showConvDeleteConfirm && (
        <>
          <div className="crm-drawer-overlay" onClick={() => !deletingConv && setShowConvDeleteConfirm(null)} />
          <div className="crm-bulk-delete-modal">
            <div className="crm-bulk-delete-icon" style={{ background: 'rgba(239,68,68,0.1)' }}>
              <Trash2 size={32} style={{ color: '#ef4444' }} />
            </div>
            <h3>Delete this conversation?</h3>
            <p>All messages in this conversation will be permanently removed. This action cannot be undone.</p>
            <div className="crm-bulk-delete-actions">
              <button className="crm-delete-cancel" onClick={() => setShowConvDeleteConfirm(null)} disabled={!!deletingConv}>
                Cancel
              </button>
              <button
                className="crm-delete-confirm-btn"
                onClick={() => deleteConversation(showConvDeleteConfirm)}
                disabled={!!deletingConv}
              >
                {deletingConv ? <Loader2 size={16} className="crm-spin" /> : <Trash2 size={16} />}
                {deletingConv ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Bulk delete confirmation */}
      {showBulkConvDeleteConfirm && (
        <>
          <div className="crm-drawer-overlay" onClick={() => !bulkDeletingConvs && setShowBulkConvDeleteConfirm(false)} />
          <div className="crm-bulk-delete-modal">
            <div className="crm-bulk-delete-icon" style={{ background: 'rgba(239,68,68,0.1)' }}>
              <Trash2 size={32} style={{ color: '#ef4444' }} />
            </div>
            <h3>Delete {selectedConvIds.size} conversation{selectedConvIds.size !== 1 ? 's' : ''}?</h3>
            <p>All messages in the selected conversations will be permanently removed. This action cannot be undone.</p>
            <div className="crm-bulk-delete-actions">
              <button className="crm-delete-cancel" onClick={() => setShowBulkConvDeleteConfirm(false)} disabled={bulkDeletingConvs}>
                Cancel
              </button>
              <button
                className="crm-delete-confirm-btn"
                onClick={() => bulkDeleteConversations(Array.from(selectedConvIds))}
                disabled={bulkDeletingConvs}
              >
                {bulkDeletingConvs ? <Loader2 size={16} className="crm-spin" /> : <Trash2 size={16} />}
                {bulkDeletingConvs ? 'Deleting...' : `Yes, Delete All Selected`}
              </button>
            </div>
          </div>
        </>
      )}

      {showProfilePanel && selectedConversation && (
        <ChatProfilePanel
          convId={selectedConversation.id}
          tableName="chat_conversations"
          displayName={`${selectedConversation.telegram_first_name || ''} ${selectedConversation.telegram_last_name || ''}`.trim() || 'Unknown'}
          phoneNumber={null}
          profilePicUrl={selectedConversation.profile_pic_url}
          lastMessageAt={selectedConversation.last_message_at}
          onClose={() => setShowProfilePanel(false)}
          onCallFromDrawer={onCall}
          stages={DEFAULT_PIPELINE_STAGES}
        />
      )}
    </div>
  );
}

// ===================== WhatsApp Inbox =====================
function WhatsAppInbox({ session, onUnreadChange, refreshKey, onRefresh, onCall }: {
  session: Session;
  onUnreadChange: (count: number) => void;
  refreshKey: number;
  onRefresh: () => void;
  onCall?: (number: string) => void;
}) {
  const [conversations, setConversations] = useState<WaConversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [waConfigured, setWaConfigured] = useState<boolean | null>(null);
  const [mediaCache, setMediaCache] = useState<Record<string, string>>({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [waTemplates, setWaTemplates] = useState<WaTemplate[]>([]);
  const [templateFilter, setTemplateFilter] = useState<string>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<WaTemplate | null>(null);
  const [templateVariables, setTemplateVariables] = useState<string[]>([]);
  const [sendingTemplate, setSendingTemplate] = useState(false);
  const [selectedConvIds, setSelectedConvIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [deletingConv, setDeletingConv] = useState<string | null>(null);
  const [bulkDeletingConvs, setBulkDeletingConvs] = useState(false);
  const [showConvDeleteConfirm, setShowConvDeleteConfirm] = useState<string | null>(null);
  const [showBulkConvDeleteConfirm, setShowBulkConvDeleteConfirm] = useState(false);
  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const [typingConvs, setTypingConvs] = useState<Record<string, boolean>>({});
  const [leadSidebar, setLeadSidebar] = useState<Lead | null>(null);
  const [leadSidebarLoading, setLeadSidebarLoading] = useState(false);
  const [showLeadSidebar, setShowLeadSidebar] = useState(false);
  const [convNotes, setConvNotes] = useState<ConvNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  const [showLabelPicker, setShowLabelPicker] = useState<string | null>(null);
  const [connectedNumber, setConnectedNumber] = useState<string | null>(null);
  const [waNumbers, setWaNumbers] = useState<WaNumberConfig[]>([]);
  const [filterNumberId, setFilterNumberId] = useState<string>('all');
  const [displayNameStatus, setDisplayNameStatus] = useState<string | null>(null);
  const [chatCallState, setChatCallState] = useState<{ status: string; phoneNumber: string; callId: string | null; sessionId: string | null } | null>(null);
  const chatCallPcRef = useRef<RTCPeerConnection | null>(null);
  const chatCallPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (chatCallPollRef.current) { clearInterval(chatCallPollRef.current); chatCallPollRef.current = null; }
      if (chatCallPcRef.current) { chatCallPcRef.current.close(); chatCallPcRef.current = null; }
    };
  }, []);

  const EMOJI_LIST = ['😀', '😂', '😍', '😎', '🤔', '😢', '😡', '👍', '👎', '❤️', '🔥', '🎉', '👏', '🙏', '💯', '✅', '❌', '⭐', '💰', '📈', '📉', '🚀', '💡', '🎯', '✨', '💪', '🤝', '👋', '😅', '🥳', '😇', '🤩', '🙄', '😤', '🤯', '🥺', '😱', '🤗', '🤫', '🤥', '😴', '🤤', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👻', '💀', '🤖', '🎃', '😺', '😸', '😻', '😼', '😽', '🙀', '😿', '😾', '🙌', '👐', '🤲', '🤟', '🤘', '🤙', '👌', '🤌', '🤏', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐️', '🖖', '👋', '🤝', '✍️', '💪', '🦾', '🦿', '👀', '👁️', '👅', '👄', '🦷', '🧠', '🦴', '🦵', '🦶', '👂', '🫀', '🫁', '🧠', '🦷', '🦴', '👀', '👁️', '👅', '👄'];

  const fetchConversations = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('wa_conversations')
      .select('*')
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (fetchError) return;
    setConversations((data || []) as WaConversation[]);
    const totalUnread = (data || []).reduce((sum, c) => sum + c.unread_count, 0);
    onUnreadChange(totalUnread);
    setLoading(false);
  }, [onUnreadChange]);

  const deleteConversation = useCallback(async (id: string) => {
    setDeletingConv(id);
    const { error: delError } = await supabase
      .from('wa_conversations')
      .delete()
      .eq('id', id);
    setDeletingConv(null);
    if (delError) {
      setError('Failed to delete conversation.');
      return;
    }
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (selectedConv === id) setSelectedConv(null);
    setSelectedConvIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    setShowConvDeleteConfirm(null);
    fetchConversations();
  }, [selectedConv, fetchConversations]);

  const bulkDeleteConversations = useCallback(async (ids: string[]) => {
    setBulkDeletingConvs(true);
    const { error: delError } = await supabase
      .from('wa_conversations')
      .delete()
      .in('id', ids);
    setBulkDeletingConvs(false);
    if (delError) {
      setError('Failed to delete conversations.');
      return;
    }
    setConversations((prev) => prev.filter((c) => !ids.includes(c.id)));
    if (selectedConv && ids.includes(selectedConv)) setSelectedConv(null);
    setSelectedConvIds(new Set());
    setShowBulkConvDeleteConfirm(false);
    setSelectMode(false);
    fetchConversations();
  }, [selectedConv, fetchConversations]);

  const toggleConvSelect = (id: string) => {
    setSelectedConvIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleSelectAllConvs = () => {
    if (selectedConvIds.size === conversations.length) {
      setSelectedConvIds(new Set());
    } else {
      setSelectedConvIds(new Set(conversations.map((c) => c.id)));
    }
  };

  useEffect(() => {
    fetchConversations();
    (async () => {
      const { data } = await supabase.from('whatsapp_settings').select('phone_number_id, access_token, connected_phone_number').order('created_at', { ascending: true }).limit(1).maybeSingle();
      setWaConfigured(Boolean(data?.phone_number_id && data?.access_token));
      setConnectedNumber(data?.connected_phone_number || null);
      const { data: allNumbers } = await supabase.from('whatsapp_settings').select('*').order('created_at', { ascending: true });
      if (allNumbers) setWaNumbers(allNumbers as WaNumberConfig[]);
      // Check display name approval status
      try {
        const statusRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-profile-picture?action=status`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setDisplayNameStatus(statusData.name_status || null);
        }
      } catch { /* non-fatal */ }
    })();
  }, [fetchConversations, refreshKey, session.access_token]);

  useEffect(() => {
    if (!selectedConv) return;
    setLoadingMessages(true);
    (async () => {
      const { data, error: fetchError } = await supabase
        .from('wa_messages')
        .select('*')
        .eq('conversation_id', selectedConv)
        .order('created_at', { ascending: true });

      if (!fetchError && data) {
        setMessages(data as WaMessage[]);
      }
      setLoadingMessages(false);

      await supabase
        .from('wa_conversations')
        .update({ unread_count: 0 })
        .eq('id', selectedConv);
      fetchConversations();
    })();
  }, [selectedConv]);

  // Real-time: subscribe to new messages in the selected conversation
  useEffect(() => {
    if (!selectedConv) return;
    const channel = supabase
      .channel(`wa_messages:${selectedConv}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'wa_messages', filter: `conversation_id=eq.${selectedConv}` },
        (payload) => {
          const newMsg = payload.new as WaMessage;
          if (newMsg.sender === 'client') {
            setTypingConvs((prev) => ({ ...prev, [selectedConv]: true }));
            setTimeout(() => {
              setTypingConvs((prev) => { const n = { ...prev }; delete n[selectedConv]; return n; });
              setMessages((prev) => {
                if (prev.some((m) => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
              });
            }, 1500);
          } else {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
        },
      )
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED' && status !== 'TIMED_OUT' && status !== 'CHANNEL_ERROR') {
          console.warn('[WhatsApp msg realtime] status:', status);
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [selectedConv]);

  // Real-time: subscribe to conversation list updates
  useEffect(() => {
    const channel = supabase
      .channel('wa_conversations_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wa_conversations' },
        (payload) => {
          fetchConversations();
          const newRow = payload.new as WaConversation | null;
          const oldRow = payload.old as WaConversation | null;
          if (newRow && 'is_typing' in newRow) {
            if (newRow.is_typing) {
              setTypingConvs((prev) => ({ ...prev, [newRow.id]: true }));
            } else {
              setTypingConvs((prev) => { const n = { ...prev }; delete n[newRow.id]; return n; });
            }
          } else if (oldRow && 'id' in oldRow) {
            setTypingConvs((prev) => { const n = { ...prev }; delete n[oldRow.id]; return n; });
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'wa_messages' },
        (payload) => {
          fetchConversations();
          const newMsg = payload.new as WaMessage;
          if (newMsg.sender === 'client' && newMsg.conversation_id !== selectedConv) {
            const convId = newMsg.conversation_id;
            setTypingConvs((prev) => ({ ...prev, [convId]: true }));
            setTimeout(() => {
              setTypingConvs((prev) => { const n = { ...prev }; delete n[convId]; return n; });
            }, 2000);
          }
        },
      )
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED' && status !== 'TIMED_OUT' && status !== 'CHANNEL_ERROR') {
          console.warn('[WhatsApp realtime] status:', status);
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [fetchConversations]);

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedConv || sending) return;
    setSending(true);
    setError('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp-message`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ conversationId: selectedConv, text: replyText.trim() }),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        setMessages((prev) => [...prev, result.message as WaMessage]);
        setReplyText('');
        fetchConversations();
      } else {
        setError(result.error || 'Failed to send message');
      }
    } catch {
      setError('Network error');
    }
    setSending(false);
  };

  const handleFileUpload = async () => {
    if (!pendingFile || !selectedConv || uploading) return;
    setUploading(true);
    setError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;

      const formData = new FormData();
      formData.append('conversationId', selectedConv);
      formData.append('caption', replyText.trim());
      formData.append('file', pendingFile);

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp-message`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const result = await response.json();
      if (response.ok && result.success) {
        setMessages((prev) => [...prev, result.message as WaMessage]);
        setReplyText('');
        setPendingFile(null);
        fetchConversations();
      } else {
        setError(result.error || 'Failed to upload file');
      }
    } catch {
      setError('Network error');
    }
    setUploading(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 16 * 1024 * 1024) {
        setError('File too large. WhatsApp allows maximum 16MB.');
        return;
      }
      setPendingFile(file);
      setError('');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const sendVoiceMessage = async () => {
    if (!pendingFile || !selectedConv || uploading) return;
    setUploading(true);
    setError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;

      const formData = new FormData();
      formData.append('conversationId', selectedConv);
      formData.append('caption', '');
      formData.append('isVoice', 'true');
      formData.append('file', pendingFile);

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp-message`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const result = await response.json();
      if (response.ok && result.success) {
        setMessages((prev) => [...prev, result.message as WaMessage]);
        setPendingFile(null);
        fetchConversations();
      } else {
        setError(result.error || 'Failed to send voice message');
      }
    } catch {
      setError('Network error');
    }
    setUploading(false);
  };

  const handleStartCallFromChat = async (rawPhoneNumber: string) => {
    if (!rawPhoneNumber || chatCallState) return;
    const cleanNumber = rawPhoneNumber.replace(/\s/g, '');
    setChatCallState({ status: 'checking_permission', phoneNumber: cleanNumber, callId: null, sessionId: null });
    try {
      const token = session.access_token;
      if (!token) { setChatCallState(null); return; }

      const permRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'check_permission', to: cleanNumber }),
      });
      const permData = await permRes.json();
      if (!permRes.ok || permData.error) { setChatCallState({ status: 'failed', phoneNumber: cleanNumber, callId: null, sessionId: null }); return; }

      if (!permData.canCall) {
        const reqRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-call`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: 'request_permission', to: cleanNumber }),
        });
        const reqData = await reqRes.json();
        if (!reqRes.ok || reqData.error) { setChatCallState({ status: 'failed', phoneNumber: cleanNumber, callId: null, sessionId: null }); return; }
        setChatCallState({ status: 'permission_requested', phoneNumber: cleanNumber, callId: null, sessionId: null });
        return;
      }

      const { data: sessionRow } = await supabase
        .from('wa_call_sessions')
        .insert({ phone_number: cleanNumber, status: 'initiating', direction: 'business_initiated', user_id: session.user.id })
        .select('id')
        .single();
      if (!sessionRow) { setChatCallState({ status: 'failed', phoneNumber: cleanNumber, callId: null, sessionId: null }); return; }

      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      chatCallPcRef.current = pc;
      const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
      pc.ontrack = (event) => { const audio = new Audio(); audio.srcObject = event.streams[0]; audio.autoplay = true; };
      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'closed') {
          if (chatCallPollRef.current) { clearInterval(chatCallPollRef.current); chatCallPollRef.current = null; }
          if (chatCallPcRef.current) { chatCallPcRef.current.close(); chatCallPcRef.current = null; }
          setChatCallState((prev) => prev ? { ...prev, status: 'ended' } : null);
        }
      };

      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
      await pc.setLocalDescription(offer);
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') { resolve(); return; }
        const check = () => { if (pc.iceGatheringState === 'complete') { pc.removeEventListener('icegatheringstatechange', check); resolve(); } };
        pc.addEventListener('icegatheringstatechange', check);
        setTimeout(resolve, 3000);
      });

      const sdpOffer = pc.localDescription?.sdp || '';
      if (!sdpOffer) { throw new Error('Failed to create call offer'); }
      setChatCallState({ status: 'calling', phoneNumber: cleanNumber, callId: null, sessionId: sessionRow.id });

      const callRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to: cleanNumber, sdpOffer, sessionId: sessionRow.id }),
      });
      const callData = await callRes.json();
      if (!callRes.ok || callData.error) {
        if (chatCallPcRef.current) { chatCallPcRef.current.close(); chatCallPcRef.current = null; }
        setChatCallState({ status: 'failed', phoneNumber: cleanNumber, callId: null, sessionId: null });
        return;
      }

      const callId = callData.callId || null;
      setChatCallState({ status: 'ringing', phoneNumber: cleanNumber, callId, sessionId: sessionRow.id });

      let pollCount = 0;
      const maxPolls = 80;
      const terminalStatuses = ['rejected', 'failed', 'ended', 'no-answer', 'busy', 'no_answer', 'timeout'];
      chatCallPollRef.current = setInterval(async () => {
        pollCount++;
        if (pollCount > maxPolls) {
          if (chatCallPollRef.current) { clearInterval(chatCallPollRef.current); chatCallPollRef.current = null; }
          setChatCallState((prev) => prev ? { ...prev, status: 'failed' } : null);
          if (chatCallPcRef.current) { chatCallPcRef.current.close(); chatCallPcRef.current = null; }
          return;
        }
        try {
          const { data: pollData } = await supabase
            .from('wa_call_sessions')
            .select('status, sdp_answer')
            .eq('id', sessionRow.id)
            .maybeSingle();
          if (!pollData) return;
          const currentStatus = (pollData.status || '').toLowerCase();
          if (terminalStatuses.includes(currentStatus)) {
            if (chatCallPollRef.current) { clearInterval(chatCallPollRef.current); chatCallPollRef.current = null; }
            if (chatCallPcRef.current) { chatCallPcRef.current.close(); chatCallPcRef.current = null; }
            setChatCallState((prev) => prev ? { ...prev, status: 'ended' } : null);
            return;
          }
          if (pollData.sdp_answer && currentStatus === 'accepted') {
            if (chatCallPollRef.current) { clearInterval(chatCallPollRef.current); chatCallPollRef.current = null; }
            try {
              await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: pollData.sdp_answer }));
              setChatCallState((prev) => prev ? { ...prev, status: 'connected' } : null);
              chatCallPollRef.current = setInterval(async () => {
                try {
                  const { data: connData } = await supabase
                    .from('wa_call_sessions')
                    .select('status')
                    .eq('id', sessionRow.id)
                    .maybeSingle();
                  if (!connData) return;
                  const connStatus = (connData.status || '').toLowerCase();
                  if (terminalStatuses.includes(connStatus)) {
                    if (chatCallPollRef.current) { clearInterval(chatCallPollRef.current); chatCallPollRef.current = null; }
                    if (chatCallPcRef.current) { chatCallPcRef.current.close(); chatCallPcRef.current = null; }
                    setChatCallState((prev) => prev ? { ...prev, status: 'ended' } : null);
                  }
                } catch { /* continue */ }
              }, 2000);
            } catch {
              setChatCallState((prev) => prev ? { ...prev, status: 'failed' } : null);
              if (chatCallPcRef.current) { chatCallPcRef.current.close(); chatCallPcRef.current = null; }
            }
          }
        } catch { /* continue polling */ }
      }, 1500);
    } catch {
      if (chatCallPcRef.current) { chatCallPcRef.current.close(); chatCallPcRef.current = null; }
      setChatCallState({ status: 'failed', phoneNumber: cleanNumber, callId: null, sessionId: null });
    }
  };

  const handleEndChatCall = async () => {
    const st = chatCallState;
    if (!st) return;
    if (chatCallPollRef.current) { clearInterval(chatCallPollRef.current); chatCallPollRef.current = null; }
    if (st.callId) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (token) {
          await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-call`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ action: 'terminate', callId: st.callId }),
          });
        }
      } catch { /* best effort */ }
    }
    if (chatCallPcRef.current) { chatCallPcRef.current.close(); chatCallPcRef.current = null; }
    setChatCallState(null);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeOptions = [
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/webm;codecs=opus',
        'audio/webm',
      ];
      let mimeType = '';
      for (const m of mimeOptions) {
        if (MediaRecorder.isTypeSupported(m)) { mimeType = m; break; }
      }
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      const actualMime = recorder.mimeType || mimeType || 'audio/webm';
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: actualMime });
        if (blob.size === 0) return;
        if (actualMime.includes('ogg')) {
          const file = new File([blob], `voice-${Date.now()}.ogg`, { type: actualMime });
          setPendingFile(file);
        } else {
          try {
            const wavBlob = await convertToWav(blob);
            const file = new File([wavBlob], `voice-${Date.now()}.wav`, { type: 'audio/wav' });
            setPendingFile(file);
          } catch {
            setError('Could not convert voice recording to a supported format. Please try again.');
          }
        }
      };
      recorder.start();
      setIsRecording(true);
      setRecordDuration(0);
      recordTimerRef.current = setInterval(() => {
        setRecordDuration((d) => d + 1);
      }, 1000);
    } catch {
      setError('Microphone access denied');
    }
  };

  const stopRecording = (cancel: boolean) => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      if (cancel) {
        mediaRecorderRef.current.onstop = () => {
          mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
        };
        setPendingFile(null);
      }
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  };

  const insertEmoji = (emoji: string) => {
    setReplyText((prev) => prev + emoji);
  };

  const isConvTyping = useCallback((convId: string | null): boolean => {
    if (!convId) return false;
    return Boolean(typingConvs[convId]);
  }, [typingConvs]);

  // Fetch lead info for the inline sidebar
  useEffect(() => {
    if (!selectedConv || !showLeadSidebar) return;
    setLeadSidebarLoading(true);
    (async () => {
      const { data: conv } = await supabase
        .from('wa_conversations')
        .select('lead_id')
        .eq('id', selectedConv)
        .maybeSingle();
      const leadId = (conv as { lead_id?: string | null } | null)?.lead_id;
      if (leadId) {
        const { data: leadData } = await supabase
          .from('submissions')
          .select('*')
          .eq('id', leadId)
          .maybeSingle();
        if (leadData) setLeadSidebar(leadData as Lead);
        else setLeadSidebar(null);
      } else {
        setLeadSidebar(null);
      }
      setLeadSidebarLoading(false);
    })();
  }, [selectedConv, showLeadSidebar]);

  // Fetch internal notes for the selected conversation
  useEffect(() => {
    if (!selectedConv) { setConvNotes([]); return; }
    (async () => {
      const { data } = await supabase
        .from('wa_conv_notes')
        .select('*')
        .eq('conversation_id', selectedConv)
        .order('created_at', { ascending: true });
      setConvNotes((data || []) as ConvNote[]);
    })();
  }, [selectedConv]);

  const handleAddNote = async () => {
    if (!newNote.trim() || !selectedConv || savingNote) return;
    setSavingNote(true);
    const { data: userData } = await supabase.auth.getUser();
    const authorName = userData.user?.email?.split('@')[0] || null;
    const { data, error: noteError } = await supabase
      .from('wa_conv_notes')
      .insert({ conversation_id: selectedConv, body: newNote.trim(), author_name: authorName })
      .select('*')
      .single();
    if (!noteError && data) {
      setConvNotes((prev) => [...prev, data as ConvNote]);
      setNewNote('');
    }
    setSavingNote(false);
  };

  const handleDeleteNote = async (noteId: string) => {
    const { error: delError } = await supabase
      .from('wa_conv_notes')
      .delete()
      .eq('id', noteId);
    if (!delError) {
      setConvNotes((prev) => prev.filter((n) => n.id !== noteId));
    }
  };

  const handleToggleLabel = async (convId: string, label: string) => {
    const conv = conversations.find((c) => c.id === convId);
    if (!conv) return;
    const currentLabels = conv.labels || [];
    const hasLabel = currentLabels.includes(label);
    const newLabels = hasLabel
      ? currentLabels.filter((l) => l !== label)
      : [...currentLabels, label];
    const { error: updateError } = await supabase
      .from('wa_conversations')
      .update({ labels: newLabels })
      .eq('id', convId);
    if (!updateError) {
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, labels: newLabels } : c))
      );
    }
    setShowLabelPicker(null);
  };

  const LABEL_COLORS: Record<string, { bg: string; text: string }> = {
    'Hot Lead': { bg: 'rgba(239,68,68,0.12)', text: '#DC2626' },
    'Follow Up': { bg: 'rgba(249,115,22,0.12)', text: '#EA580C' },
    'Callback': { bg: 'rgba(59,130,246,0.12)', text: '#2563EB' },
    'Interested': { bg: 'rgba(22,163,74,0.12)', text: '#15803D' },
    'High Budget': { bg: 'rgba(234,179,8,0.12)', text: '#854D0E' },
    'Beginner': { bg: 'rgba(99,102,241,0.12)', text: '#6366F1' },
    'Closed': { bg: 'rgba(107,114,128,0.12)', text: '#4B5563' },
  };

  const getLabelStyle = (label: string) => LABEL_COLORS[label] || { bg: 'rgba(99,102,241,0.12)', text: '#6366F1' };

  const allLabelsInUse = useMemo(() => {
    const set = new Set<string>();
    conversations.forEach((c) => (c.labels || []).forEach((l) => set.add(l)));
    return Array.from(set);
  }, [conversations]);

  const filteredConversations = useMemo(() => {
    if (!labelFilter) return conversations;
    return conversations.filter((c) => (c.labels || []).includes(labelFilter));
  }, [conversations, labelFilter]);

  // ---- WhatsApp template sending from inbox ----
  const fetchWaTemplates = useCallback(async () => {
    try {
      const { data, error: tplError } = await supabase
        .from('wa_message_templates')
        .select('*')
        .order('created_at', { ascending: false });
      if (!tplError && data) {
        setWaTemplates(data as WaTemplate[]);
        // Auto-sync from Meta to pick up newly approved templates
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (token) {
          const { data: settings } = await supabase
            .from('whatsapp_settings')
            .select('waba_id, access_token')
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();
          if (settings?.waba_id && settings?.access_token) {
            const syncRes = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-templates?action=list`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (syncRes.ok) {
              const syncData = await syncRes.json();
              if (syncData.templates) {
                const syncedRows = syncData.templates.map((t: Record<string, unknown>) => {
                  const existing = (data as WaTemplate[]).find(
                    (d) => d.name === t.name && d.language === t.language
                  );
                  return { ...existing, ...t, id: existing?.id || '' } as WaTemplate;
                });
                setWaTemplates(syncedRows.filter((t: WaTemplate) => t.status === 'APPROVED'));
                return;
              }
            }
          }
        }
        setWaTemplates((data as WaTemplate[]).filter((t) => t.status === 'APPROVED'));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchWaTemplates();
  }, [fetchWaTemplates]);

  const extractTemplateVariables = (template: WaTemplate): { body: string; vars: string[] } => {
    const bodyComp = template.components?.find(
      (c) => (c as Record<string, unknown>).type === 'BODY'
    ) as Record<string, unknown> | undefined;
    const bodyText = (bodyComp?.text as string) || '';
    const matches = bodyText.match(/\{\{(\d+)\}\}/g) || [];
    const vars = [...new Set(matches)].sort();
    return { body: bodyText, vars };
  };

  const handleSelectTemplate = (template: WaTemplate) => {
    setSelectedTemplate(template);
    const { vars } = extractTemplateVariables(template);
    setTemplateVariables(vars.map(() => ''));
  };

  const handleSendTemplate = async () => {
    if (!selectedTemplate || !selectedConv || sendingTemplate) return;
    const { vars } = extractTemplateVariables(selectedTemplate);
    const hasEmpty = vars.some((_, i) => !templateVariables[i]?.trim());
    if (hasEmpty) {
      setError('Please fill in all template variables before sending.');
      return;
    }
    setSendingTemplate(true);
    setError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;

      // Build send-API components with parameter values
      const sendComponents = selectedTemplate.components
        ? selectedTemplate.components
            .map((c) => {
              const comp = c as Record<string, unknown>;
              const typeStr = typeof comp.type === 'string' ? (comp.type as string).toLowerCase() : '';
              if (typeStr === 'body' && vars.length > 0) {
                return {
                  type: 'body',
                  parameters: vars.map((_, i) => ({ type: 'text', text: templateVariables[i] })),
                };
              }
              if (typeStr === 'header') {
                const headerText = comp.text as string;
                const headerVars = headerText?.match(/\{\{(\d+)\}\}/g) || [];
                if (headerVars.length > 0) {
                  return {
                    type: 'header',
                    parameters: [{ type: 'text', text: templateVariables[0] }],
                  };
                }
              }
              return null;
            })
            .filter((c) => c !== null)
        : [];

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversationId: selectedConv,
          templateName: selectedTemplate.name,
          templateLanguage: selectedTemplate.language,
          templateComponents: sendComponents,
        }),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        setMessages((prev) => [...prev, result.message as WaMessage]);
        setSelectedTemplate(null);
        setTemplateVariables([]);
        setShowTemplatePicker(false);
        fetchConversations();
      } else {
        setError(result.error || 'Failed to send template message');
      }
    } catch {
      setError('Network error');
    }
    setSendingTemplate(false);
  };

  const getMediaUrl = useCallback((msg: WaMessage): string | null => {
    if (!msg.media_id) return null;
    if (mediaCache[msg.id]) return mediaCache[msg.id];
    const fetchUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-file?media_id=${encodeURIComponent(msg.media_id)}&message_id=${msg.id}`;
    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) return;
        const res = await fetch(fetchUrl, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const blob = await res.blob();
        const objUrl = URL.createObjectURL(blob);
        setMediaCache((prev) => ({ ...prev, [msg.id]: objUrl }));
      } catch {
        // ignore
      }
    })();
    return null;
  }, [mediaCache]);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderTextWithLinks = (text: string, isAdmin: boolean = false) => {
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
      if (urlRegex.test(part)) {
        return (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: isAdmin ? '#bfdbfe' : '#2563eb', textDecoration: 'underline', wordBreak: 'break-all' }}>
            {part}
          </a>
        );
      }
      return part;
    });
  };

  const renderMessageContent = (msg: WaMessage) => {
    switch (msg.message_type) {
      case 'text':
        return <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{renderTextWithLinks(msg.text_content || '', msg.sender === 'admin')}</div>;

      case 'image': {
        const url = getMediaUrl(msg);
        return (
          <div>
            {url ? (
              <img src={url} alt="Photo" style={{ maxWidth: '280px', borderRadius: '8px', display: 'block', marginBottom: msg.text_content ? '6px' : 0 }} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', minWidth: '200px' }}>
                <Loader2 size={18} className="crm-spin" />
                <span style={{ fontSize: '0.8rem' }}>Loading photo...</span>
              </div>
            )}
            {msg.text_content && <div style={{ whiteSpace: 'pre-wrap' }}>{renderTextWithLinks(msg.text_content, msg.sender === 'admin')}</div>}
          </div>
        );
      }

      case 'video': {
        const url = getMediaUrl(msg);
        return (
          <div>
            {url ? (
              <video controls style={{ maxWidth: '280px', borderRadius: '8px', display: 'block', marginBottom: msg.text_content ? '6px' : 0 }}>
                <source src={url} />
              </video>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', minWidth: '200px' }}>
                <Loader2 size={18} className="crm-spin" />
                <span style={{ fontSize: '0.8rem' }}>Loading video...</span>
              </div>
            )}
            {msg.text_content && <div style={{ whiteSpace: 'pre-wrap' }}>{renderTextWithLinks(msg.text_content, msg.sender === 'admin')}</div>}
          </div>
        );
      }

      case 'voice':
      case 'audio': {
        const url = getMediaUrl(msg);
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '200px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: msg.sender === 'client' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Mic size={18} />
              </div>
              <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>{msg.message_type === 'voice' ? 'Voice message' : 'Audio'}</span>
            </div>
            {url ? <audio controls style={{ width: '100%' }}><source src={url} /></audio> : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', opacity: 0.7 }}>
                <Loader2 size={14} className="crm-spin" /> Loading audio...
              </div>
            )}
            {msg.text_content && <div style={{ whiteSpace: 'pre-wrap' }}>{renderTextWithLinks(msg.text_content, msg.sender === 'admin')}</div>}
          </div>
        );
      }

      case 'document': {
        const url = getMediaUrl(msg);
        return (
          <a href={url || '#'} target="_blank" rel="noopener noreferrer" download={msg.file_name || undefined} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', textDecoration: 'none', color: 'inherit', minWidth: '200px', opacity: url ? 1 : 0.5, pointerEvents: url ? 'auto' : 'none' }}>
            <FileIcon size={24} />
            <div>
              <strong style={{ fontSize: '0.82rem', display: 'block' }}>{msg.file_name || 'Document'}</strong>
              {msg.file_size && <span style={{ fontSize: '0.72rem', opacity: 0.7 }}>{formatFileSize(msg.file_size)}</span>}
            </div>
          </a>
        );
      }

      case 'template':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '180px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', opacity: 0.7, fontWeight: 600 }}>
              <LayoutTemplate size={14} /> Template
            </div>
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{renderTextWithLinks(msg.text_content || '', msg.sender === 'admin')}</div>
          </div>
        );

      case 'sticker':
        return <div style={{ fontSize: '3rem', lineHeight: 1 }}>🏷️</div>;

      case 'location':
        return (
          <a href={`https://maps.google.com/?q=${msg.latitude},${msg.longitude}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', textDecoration: 'none', color: 'inherit' }}>
            <MapPin size={20} />
            <span style={{ fontSize: '0.82rem' }}>Location: {msg.latitude?.toFixed(4)}, {msg.longitude?.toFixed(4)}</span>
          </a>
        );

      default:
        return <div>{msg.text_content || 'Unsupported message type'}</div>;
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px', padding: '20px' }}>
        <Loader2 size={32} className="crm-spin" style={{ color: '#25D366' }} />
      </div>
    );
  }

  if (waConfigured === false) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', textAlign: 'center', padding: '24px' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'linear-gradient(135deg, #25D366, #128C7E)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
          <PhoneIcon size={32} style={{ color: 'var(--bg-card)' }} />
        </div>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px' }}>WhatsApp Not Configured</h2>
        <p style={{ color: 'var(--text-dark)', fontSize: '0.88rem', maxWidth: '400px', lineHeight: 1.6, marginBottom: '20px' }}>
          To use the WhatsApp chat inbox, you need to configure your WhatsApp Business API credentials in Settings. Add your Phone Number ID and Access Token from Meta Business Manager.
        </p>
      </div>
    );
  }

  const selectedConversation = conversations.find((c) => c.id === selectedConv);

  return (
    <div className="crm-chat-container wa-theme">
      {displayNameStatus && displayNameStatus !== 'APPROVED' && (
        <div style={{
          padding: '10px 16px',
          background: 'rgba(234,179,8,0.1)',
          borderBottom: '1px solid rgba(234,179,8,0.3)',
          display: 'flex', alignItems: 'center', gap: '8px',
          fontSize: '0.78rem', color: '#a16207', fontWeight: 600,
        }}>
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
          <span>Your WhatsApp display name is {displayNameStatus.replace(/_/g, ' ').toLowerCase()}. Outgoing messages are blocked until Meta approves it. Go to Settings → WhatsApp to submit or check the status.</span>
        </div>
      )}
      <div className={`crm-chat-list ${selectedConv ? 'hidden-mobile' : ''}`}>
        <div className="crm-chat-list-header">
          <div className="crm-chat-list-heading">
            <h2>WhatsApp Inbox</h2>
            <span>{filterNumberId === 'all' ? conversations.length : conversations.filter(c => c.wa_settings_id === filterNumberId).length} conversations</span>
            {waNumbers.length > 1 && (
              <select
                value={filterNumberId}
                onChange={(e) => setFilterNumberId(e.target.value)}
                style={{ fontSize: '0.72rem', padding: '3px 8px', border: '1px solid var(--border-subtle)', borderRadius: '6px', background: 'var(--bg-card)', color: 'var(--text-muted)', fontWeight: 600, cursor: 'pointer' }}
              >
                <option value="all">All Numbers</option>
                {waNumbers.map((n) => (
                  <option key={n.id} value={n.id}>{n.label || n.connected_phone_number || n.phone_number_id}</option>
                ))}
              </select>
            )}
            {waNumbers.length <= 1 && connectedNumber && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 8px', background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.3)', borderRadius: '6px', fontSize: '0.68rem', color: '#128C7E', fontWeight: 600, whiteSpace: 'nowrap' }}>
                <PhoneIcon size={11} />
                <span>Connected: {connectedNumber}</span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              className="crm-chat-refresh"
              onClick={() => { setSelectMode((v) => !v); setSelectedConvIds(new Set()); }}
              aria-label={selectMode ? 'Cancel selection' : 'Select conversations'}
              style={selectMode ? { background: '#EAB308', color: '#422006' } : undefined}
            >
              {selectMode ? <X size={16} /> : <CheckSquare size={16} />}
            </button>
            <button className="crm-chat-refresh" onClick={() => { fetchConversations(); onRefresh(); }} aria-label="Refresh">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
        {selectMode && conversations.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-light)' }}>
            <button
              onClick={toggleSelectAllConvs}
              style={{ fontSize: '0.8rem', fontWeight: 600, color: '#25D366', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {selectedConvIds.size === conversations.length ? <CheckSquare size={15} /> : <Square size={15} />}
              {selectedConvIds.size === conversations.length ? 'Deselect all' : 'Select all'}
            </button>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-dark)', fontWeight: 600 }}>
              {selectedConvIds.size} selected
            </span>
            {selectedConvIds.size > 0 && (
              <button
                onClick={() => setShowBulkConvDeleteConfirm(true)}
                disabled={bulkDeletingConvs}
                style={{ fontSize: '0.8rem', fontWeight: 600, color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Trash2 size={15} /> Delete
              </button>
            )}
          </div>
        )}
        <div className="crm-chat-search">
          <Search size={16} />
          <input placeholder="Search conversations" aria-label="Search conversations" />
        </div>
        {allLabelsInUse.length > 0 && (
          <div style={{ display: 'flex', gap: '4px', padding: '6px 12px', flexWrap: 'wrap', borderBottom: '1px solid var(--border-subtle)' }}>
            <button
              onClick={() => setLabelFilter(null)}
              type="button"
              style={{
                fontSize: '0.68rem', fontWeight: 600, padding: '3px 8px', borderRadius: '5px', border: 'none', cursor: 'pointer',
                background: labelFilter === null ? '#0F172A' : 'var(--bg-light)', color: labelFilter === null ? '#fff' : 'var(--text-dark)',
                transition: 'all 0.15s',
              }}
            >All</button>
            {allLabelsInUse.map((label) => {
              const style = getLabelStyle(label);
              return (
                <button
                  key={label}
                  onClick={() => setLabelFilter(labelFilter === label ? null : label)}
                  type="button"
                  style={{
                    fontSize: '0.68rem', fontWeight: 600, padding: '3px 8px', borderRadius: '5px', border: 'none', cursor: 'pointer',
                    background: labelFilter === label ? style.text : style.bg, color: labelFilter === label ? '#fff' : style.text,
                    transition: 'all 0.15s',
                  }}
                >{label}</button>
              );
            })}
          </div>
        )}
        <div className="crm-chat-list-body">
          {(filterNumberId === 'all' ? filteredConversations : filteredConversations.filter(c => c.wa_settings_id === filterNumberId)).length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-dark)' }}>
              <PhoneIcon size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <p style={{ fontSize: '0.85rem' }}>
                {labelFilter
                  ? `No conversations labeled "${labelFilter}".`
                  : 'No conversations yet. When clients message your WhatsApp Business number, they\'ll appear here.'}
              </p>
            </div>
          ) : (
            (filterNumberId === 'all' ? filteredConversations : filteredConversations.filter(c => c.wa_settings_id === filterNumberId)).map((conv) => (
              <div
                key={conv.id}
                className={`crm-chat-conv-item ${selectedConv === conv.id ? 'active' : ''}`}
                style={{ display: 'flex', alignItems: 'center', gap: selectMode ? '8px' : 0, padding: selectMode ? '12px 12px 12px 8px' : undefined }}
              >
                {selectMode && (
                  <button
                    onClick={() => toggleConvSelect(conv.id)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', flexShrink: 0 }}
                    aria-label="Select conversation"
                  >
                    {selectedConvIds.has(conv.id)
                      ? <CheckSquare size={20} style={{ color: '#25D366' }} />
                      : <Square size={20} style={{ color: 'var(--text-dark)' }} />}
                  </button>
                )}
                <button
                  onClick={() => !selectMode && setSelectedConv(conv.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0, border: 'none', background: 'none', cursor: selectMode ? 'default' : 'pointer', padding: 0, textAlign: 'left' }}
                >
                  <div className="crm-chat-conv-avatar-wrap">
                    {conv.profile_pic_url ? (
                      <img src={conv.profile_pic_url} alt="" className="crm-chat-conv-avatar-img" />
                    ) : (
                      <div className="crm-chat-conv-avatar" style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)' }}>
                        {(conv.wa_name?.[0] || conv.wa_phone_number?.[1] || '?').toUpperCase()}
                      </div>
                    )}
                    <span className={`crm-chat-status-dot ${getLastSeenStatus(conv.last_message_at).online ? 'online' : 'offline'}`} />
                  </div>
                  <div className="crm-chat-conv-info">
                    <div className="crm-chat-conv-top">
                      <strong className="crm-chat-conv-name">
                        {conv.wa_name || 'Unknown'}
                      </strong>
                      {conv.last_message_at && (
                        <span className="crm-chat-conv-time">{formatTime(conv.last_message_at)}</span>
                      )}
                      {conv.wa_phone_number && (
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-dark)', fontWeight: 400, display: 'block', marginTop: '-1px' }}>{conv.wa_phone_number}</span>
                      )}
                    </div>
                    {(conv.labels || []).length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginBottom: '2px' }}>
                        {(conv.labels || []).map((label) => {
                          const ls = getLabelStyle(label);
                          return (
                            <span key={label} style={{ fontSize: '0.6rem', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: ls.bg, color: ls.text }}>{label}</span>
                          );
                        })}
                      </div>
                    )}
                    <div className="crm-chat-conv-bottom">
                      <span className="crm-chat-conv-preview" style={isConvTyping(conv.id) ? { color: '#25D366', fontStyle: 'italic' } : undefined}>
                        {isConvTyping(conv.id) ? 'typing...' : (conv.last_message_text || 'No messages')}
                      </span>
                      {conv.unread_count > 0 && !isConvTyping(conv.id) && (
                        <span className="crm-chat-unread-badge" style={{ background: '#25D366', color: 'var(--bg-card)' }}>{conv.unread_count}</span>
                      )}
                    </div>
                  </div>
                </button>
                {!selectMode && (
                  <div style={{ position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <button
                      onClick={() => setShowLabelPicker(showLabelPicker === conv.id ? null : conv.id)}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '8px', color: 'var(--text-dark)', display: 'flex', alignItems: 'center' }}
                      aria-label="Manage labels"
                      type="button"
                    >
                      <Tag size={16} />
                    </button>
                    <button
                      onClick={() => setShowConvDeleteConfirm(conv.id)}
                      disabled={deletingConv === conv.id}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '8px', color: 'var(--text-dark)', display: 'flex', alignItems: 'center' }}
                      aria-label="Delete conversation"
                    >
                      {deletingConv === conv.id ? <Loader2 size={16} className="crm-spin" /> : <Trash2 size={16} />}
                    </button>
                    {showLabelPicker === conv.id && (
                      <div style={{ position: 'absolute', top: '100%', right: '0', zIndex: 100, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '10px', minWidth: '200px' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span>Labels</span>
                          <button onClick={() => setShowLabelPicker(null)} type="button" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-dark)', padding: 0 }}><X size={14} /></button>
                        </div>
                        {Object.keys(LABEL_COLORS).map((label) => {
                          const ls = LABEL_COLORS[label];
                          const active = (conv.labels || []).includes(label);
                          return (
                            <button
                              key={label}
                              onClick={() => handleToggleLabel(conv.id, label)}
                              type="button"
                              style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '6px 8px', border: 'none', borderRadius: '6px', background: active ? ls.bg : 'transparent', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 600, color: active ? ls.text : '#475569', transition: 'background 0.15s' }}
                            >
                              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: ls.text, flexShrink: 0 }} />
                              {label}
                              {active && <Check size={14} style={{ marginLeft: 'auto' }} />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className={`crm-chat-thread ${selectedConv ? 'visible-mobile' : ''}`}>
        {!selectedConv ? (
          <div className="crm-chat-empty">
            <PhoneIcon size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
            <p style={{ fontSize: '0.9rem' }}>Select a conversation to view messages</p>
          </div>
        ) : (
          <>
            <div className="crm-chat-header">
              <button className="crm-chat-back-btn" onClick={() => setSelectedConv(null)} aria-label="Back">
                <ArrowLeft size={20} />
              </button>
              <button className="crm-chat-header-profile-btn" onClick={() => setShowProfilePanel(true)} aria-label="View profile">
                <div className="crm-chat-header-avatar-wrap">
                  {selectedConversation?.profile_pic_url ? (
                    <img src={selectedConversation.profile_pic_url} alt="" className="crm-chat-header-avatar-img" />
                  ) : (
                    <div className="crm-chat-header-avatar" style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)' }}>
                      {(selectedConversation?.wa_name?.[0] || '?').toUpperCase()}
                    </div>
                  )}
                  <span className={`crm-chat-header-status-dot ${getLastSeenStatus(selectedConversation?.last_message_at || null).online ? 'online' : 'offline'}`} />
                </div>
                <div className="crm-chat-header-copy">
                  <strong>{selectedConversation?.wa_name || 'Unknown'}</strong>
                  {selectedConversation?.wa_phone_number && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dark)', fontWeight: 400, display: 'block' }}>{selectedConversation.wa_phone_number}</span>
                  )}
                  <span className="crm-chat-status-text" style={isConvTyping(selectedConv) ? { color: '#25D366', fontStyle: 'italic' } : undefined}>
                    {isConvTyping(selectedConv) ? 'typing...' : getLastSeenStatus(selectedConversation?.last_message_at || null).label}
                  </span>
                </div>
              </button>
              <button
                onClick={() => setShowLeadSidebar((v) => !v)}
                aria-label="Toggle lead info"
                type="button"
                style={{
                  border: 'none',
                  borderRadius: '50%',
                  width: '36px', height: '36px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                  background: showLeadSidebar ? 'rgba(37,211,102,0.15)' : 'rgba(99,102,241,0.1)',
                  color: showLeadSidebar ? '#128C7E' : '#6366F1',
                  transition: 'all 0.2s',
                }}
              >
                <UserCheck size={18} />
              </button>
              <button
                onClick={() => selectedConversation && handleStartCallFromChat(selectedConversation.wa_phone_number)}
                disabled={!!chatCallState}
                aria-label="Call this contact"
                type="button"
                style={{
                  border: 'none',
                  borderRadius: '50%',
                  width: '36px', height: '36px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: chatCallState ? 'not-allowed' : 'pointer',
                  background: chatCallState ? 'var(--border-subtle)' : 'rgba(37,211,102,0.12)',
                  color: chatCallState ? '#94a3b8' : '#16a34a',
                  transition: 'all 0.2s',
                }}
              >
                {chatCallState ? <Loader2 size={18} className="crm-spin" /> : <PhoneIcon size={18} />}
              </button>
              <button className="crm-chat-header-action" aria-label="Conversation options"><MoreVertical size={18} /></button>
            </div>

            <div className="crm-chat-messages">
              <div className="crm-chat-date-sep"><span>Today</span></div>
              {loadingMessages ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                  <Loader2 size={24} className="crm-spin" style={{ color: '#25D366' }} />
                </div>
              ) : messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-dark)', padding: '40px', fontSize: '0.85rem' }}>
                  No messages yet. Start the conversation by sending a reply below.
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} style={{
                    display: 'flex',
                    justifyContent: msg.sender === 'admin' ? 'flex-end' : 'flex-start',
                  }}>
                    <div className={`crm-chat-bubble ${msg.sender === 'admin' ? 'crm-chat-bubble-admin' : 'crm-chat-bubble-client'}`}>
                      {renderMessageContent(msg)}
                      <div className="crm-chat-bubble-time" style={{ textAlign: msg.sender === 'admin' ? 'right' : 'left' }}>
                        {formatTime(msg.created_at)}
                      </div>
                    </div>
                  </div>
                ))
              )}
              {isConvTyping(selectedConv) && (
                <div style={{ display: 'flex', justifyContent: 'flex-start', padding: '4px 0' }}>
                  <div className="crm-chat-bubble crm-chat-bubble-client" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="wa-typing-dot" />
                    <span className="wa-typing-dot" />
                    <span className="wa-typing-dot" />
                  </div>
                </div>
              )}
            </div>

            <div className="crm-chat-reply-bar">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.txt"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              {pendingFile && (
                <div className="crm-chat-pending-file">
                  <div className="crm-chat-pending-icon">
                    {pendingFile.type.startsWith('image/') ? <ImageIcon size={18} /> :
                     pendingFile.type.startsWith('video/') ? <VideoIcon size={18} /> :
                     pendingFile.type.startsWith('audio/') ? <Mic size={18} /> :
                     <FileIcon size={18} />}
                  </div>
                  <div className="crm-chat-pending-info">
                    <strong>{pendingFile.name}</strong>
                    <span>{(pendingFile.size / 1024).toFixed(1)} KB</span>
                  </div>
                  <button
                    className="crm-chat-pending-remove"
                    onClick={() => setPendingFile(null)}
                    aria-label="Remove file"
                  >
                    <XIcon size={14} />
                  </button>
                </div>
              )}
              {showEmojiPicker && (
                <div className="crm-chat-emoji-picker">
                  <div className="crm-chat-emoji-grid">
                    {EMOJI_LIST.map((emoji, i) => (
                      <button
                        key={i}
                        className="crm-chat-emoji-btn"
                        onClick={() => insertEmoji(emoji)}
                        type="button"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {isRecording && (
                <div className="crm-chat-recording-bar">
                  <div className="crm-chat-recording-dot" />
                  <span className="crm-chat-recording-time">
                    {Math.floor(recordDuration / 60)}:{(recordDuration % 60).toString().padStart(2, '0')}
                  </span>
                  <span className="crm-chat-recording-label">Recording...</span>
                  <button
                    className="crm-chat-recording-cancel"
                    onClick={() => stopRecording(true)}
                    type="button"
                    aria-label="Cancel recording"
                  >
                    <XIcon size={16} /> Cancel
                  </button>
                  <button
                    className="crm-chat-recording-send"
                    onClick={() => { stopRecording(false); }}
                    type="button"
                    aria-label="Stop and send voice"
                    disabled={recordDuration < 1}
                  >
                    <Send size={16} /> Send
                  </button>
                </div>
              )}
              {pendingFile && pendingFile.type.startsWith('audio/') && !isRecording && (
                <div className="crm-chat-pending-file">
                  <div className="crm-chat-pending-icon">
                    <Mic size={18} />
                  </div>
                  <div className="crm-chat-pending-info">
                    <strong>Voice message</strong>
                    <span>{(pendingFile.size / 1024).toFixed(1)} KB</span>
                  </div>
                  <button
                    className="crm-chat-pending-remove"
                    onClick={() => setPendingFile(null)}
                    aria-label="Remove file"
                  >
                    <XIcon size={14} />
                  </button>
                  <button
                    className="crm-chat-recording-send"
                    onClick={sendVoiceMessage}
                    disabled={uploading}
                    type="button"
                  >
                    {uploading ? <Loader2 size={16} className="crm-spin" /> : <Send size={16} />} Send
                  </button>
                </div>
              )}
              {error && (
                <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#dc2626', fontSize: '0.78rem', fontWeight: 600, marginBottom: '8px' }}>
                  {error}
                </div>
              )}

              {/* Template picker panel */}
              {showTemplatePicker && !selectedTemplate && (
                <div style={{
                  marginBottom: '8px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '10px',
                  maxHeight: '320px',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <LayoutTemplate size={15} /> Approved Templates
                    </span>
                    <button
                      onClick={() => setShowTemplatePicker(false)}
                      type="button"
                      aria-label="Close templates"
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-dark)', padding: '2px' }}
                    >
                      <XIcon size={16} />
                    </button>
                  </div>
                  {waTemplates.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-dark)', fontSize: '0.8rem' }}>
                      No approved templates yet. Create and get templates approved in the WhatsApp Templates page first.
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', gap: '6px', padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
                        {['all', 'MARKETING', 'UTILITY', 'AUTHENTICATION'].map((cat) => (
                          <button
                            key={cat}
                            onClick={() => setTemplateFilter(cat)}
                            type="button"
                            style={{
                              fontSize: '0.7rem', fontWeight: 600, padding: '4px 10px', borderRadius: '6px', border: 'none',
                              cursor: 'pointer',
                              background: templateFilter === cat
                                ? (cat === 'MARKETING' ? '#C2410C' : cat === 'UTILITY' ? '#0891B2' : cat === 'AUTHENTICATION' ? '#DC2626' : '#25D366')
                                : 'var(--bg-light)',
                              color: templateFilter === cat ? '#fff' : 'var(--text-dark)',
                              transition: 'all 0.15s',
                            }}
                          >
                            {cat === 'all' ? 'All' : cat.charAt(0) + cat.slice(1).toLowerCase()}
                          </button>
                        ))}
                      </div>
                      <div style={{ overflowY: 'auto', flex: 1 }}>
                        {waTemplates
                          .filter((t) => templateFilter === 'all' || t.category === templateFilter)
                          .map((tpl) => {
                            const bodyComp = tpl.components?.find((c: Record<string, unknown>) => c.type === 'BODY') as Record<string, unknown> | undefined;
                            const bodyText = (bodyComp?.text as string) || '';
                            return (
                              <button
                                key={tpl.id}
                                onClick={() => handleSelectTemplate(tpl)}
                                type="button"
                                style={{
                                  width: '100%', textAlign: 'left', border: 'none', borderBottom: '1px solid #f8fafc',
                                  background: 'none', cursor: 'pointer', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '3px',
                                  transition: 'background 0.15s',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-light)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{
                                    fontSize: '0.62rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px',
                                    background: tpl.category === 'MARKETING' ? 'rgba(194,65,12,0.1)' : tpl.category === 'UTILITY' ? 'rgba(8,145,178,0.1)' : 'rgba(220,38,38,0.1)',
                                    color: tpl.category === 'MARKETING' ? '#C2410C' : tpl.category === 'UTILITY' ? '#0891B2' : '#DC2626',
                                    textTransform: 'uppercase', letterSpacing: '0.03em',
                                  }}>
                                    {tpl.category}
                                  </span>
                                  <strong style={{ fontSize: '0.78rem', color: 'var(--text-main)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {tpl.name}
                                  </strong>
                                  <span style={{ fontSize: '0.62rem', color: 'var(--text-dark)' }}>{tpl.language}</span>
                                </div>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {bodyText}
                                </span>
                              </button>
                            );
                          })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Template variable input panel */}
              {selectedTemplate && (
                <div style={{
                  marginBottom: '8px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '10px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <LayoutTemplate size={15} /> {selectedTemplate.name}
                    </span>
                    <button
                      onClick={() => { setSelectedTemplate(null); setTemplateVariables([]); }}
                      type="button"
                      aria-label="Cancel template"
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-dark)', padding: '2px' }}
                    >
                      <XIcon size={16} />
                    </button>
                  </div>
                  {(() => {
                    const { vars, body } = extractTemplateVariables(selectedTemplate);
                    if (vars.length === 0) {
                      return (
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-dark)', lineHeight: 1.5, background: 'var(--bg-light)', padding: '8px 10px', borderRadius: '6px' }}>
                          {body || 'No variables needed for this template.'}
                        </div>
                      );
                    }
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-dark)', background: 'var(--bg-light)', padding: '8px 10px', borderRadius: '6px', lineHeight: 1.4 }}>
                          {body}
                        </div>
                        {vars.map((v, i) => (
                          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                              Variable {v}
                            </label>
                            <input
                              type="text"
                              value={templateVariables[i] || ''}
                              onChange={(e) => {
                                const next = [...templateVariables];
                                next[i] = e.target.value;
                                setTemplateVariables(next);
                              }}
                              placeholder={`Enter value for ${v}`}
                              style={{
                                fontSize: '0.8rem', padding: '6px 10px', border: '1px solid var(--border-subtle)',
                                borderRadius: '6px', outline: 'none', color: 'var(--text-main)',
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  <button
                    onClick={handleSendTemplate}
                    disabled={sendingTemplate}
                    type="button"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      padding: '8px 16px', borderRadius: '8px', border: 'none',
                      background: '#25D366', color: 'var(--bg-card)', fontSize: '0.82rem', fontWeight: 600,
                      cursor: sendingTemplate ? 'not-allowed' : 'pointer', opacity: sendingTemplate ? 0.6 : 1,
                      transition: 'all 0.15s',
                    }}
                  >
                    {sendingTemplate ? <Loader2 size={15} className="crm-spin" /> : <Send size={15} />}
                    Send Template
                  </button>
                </div>
              )}

              <div className="crm-chat-reply-row">
                <button
                  className="crm-chat-attach-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || sending || isRecording}
                  aria-label="Attach file"
                  type="button"
                >
                  <Paperclip size={20} />
                </button>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
                  placeholder={isRecording ? 'Recording voice message...' : 'Type your reply...'}
                  rows={1}
                  className="crm-chat-reply-input"
                  disabled={isRecording}
                />
                <button
                  className={`crm-chat-mic-btn ${isRecording ? 'recording' : ''}`}
                  onClick={isRecording ? () => stopRecording(false) : startRecording}
                  disabled={uploading || sending || (pendingFile != null && !pendingFile.type.startsWith('audio/'))}
                  aria-label={isRecording ? 'Stop recording' : 'Record voice message'}
                  type="button"
                >
                  {isRecording ? <Loader2 size={20} className="crm-spin" /> : <Mic size={20} />}
                </button>
                <button
                  className="crm-chat-emoji-toggle"
                  onClick={() => setShowEmojiPicker((v) => !v)}
                  disabled={isRecording}
                  aria-label="Emoji picker"
                  type="button"
                >
                  <Smile size={20} />
                </button>
                <button
                  className="crm-chat-emoji-toggle"
                  onClick={() => { setShowTemplatePicker((v) => !v); setSelectedTemplate(null); setTemplateVariables([]); }}
                  disabled={isRecording || uploading || sending}
                  aria-label="Template picker"
                  type="button"
                  style={showTemplatePicker ? { color: '#25D366', background: 'rgba(37,211,102,0.12)' } : undefined}
                >
                  <LayoutTemplate size={20} />
                </button>
                <button
                  onClick={pendingFile ? (pendingFile.type.startsWith('audio/') ? sendVoiceMessage : handleFileUpload) : handleSendReply}
                  disabled={pendingFile ? uploading : (!replyText.trim() || sending)}
                  className="crm-chat-send-btn"
                  aria-label="Send"
                >
                  {uploading || sending ? <Loader2 size={18} className="crm-spin" /> : <Send size={18} />}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Single delete confirmation */}
      {showConvDeleteConfirm && (
        <>
          <div className="crm-drawer-overlay" onClick={() => !deletingConv && setShowConvDeleteConfirm(null)} />
          <div className="crm-bulk-delete-modal">
            <div className="crm-bulk-delete-icon" style={{ background: 'rgba(239,68,68,0.1)' }}>
              <Trash2 size={32} style={{ color: '#ef4444' }} />
            </div>
            <h3>Delete this conversation?</h3>
            <p>All messages in this conversation will be permanently removed. This action cannot be undone.</p>
            <div className="crm-bulk-delete-actions">
              <button className="crm-delete-cancel" onClick={() => setShowConvDeleteConfirm(null)} disabled={!!deletingConv}>
                Cancel
              </button>
              <button
                className="crm-delete-confirm-btn"
                onClick={() => deleteConversation(showConvDeleteConfirm)}
                disabled={!!deletingConv}
              >
                {deletingConv ? <Loader2 size={16} className="crm-spin" /> : <Trash2 size={16} />}
                {deletingConv ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Bulk delete confirmation */}
      {showBulkConvDeleteConfirm && (
        <>
          <div className="crm-drawer-overlay" onClick={() => !bulkDeletingConvs && setShowBulkConvDeleteConfirm(false)} />
          <div className="crm-bulk-delete-modal">
            <div className="crm-bulk-delete-icon" style={{ background: 'rgba(239,68,68,0.1)' }}>
              <Trash2 size={32} style={{ color: '#ef4444' }} />
            </div>
            <h3>Delete {selectedConvIds.size} conversation{selectedConvIds.size !== 1 ? 's' : ''}?</h3>
            <p>All messages in the selected conversations will be permanently removed. This action cannot be undone.</p>
            <div className="crm-bulk-delete-actions">
              <button className="crm-delete-cancel" onClick={() => setShowBulkConvDeleteConfirm(false)} disabled={bulkDeletingConvs}>
                Cancel
              </button>
              <button
                className="crm-delete-confirm-btn"
                onClick={() => bulkDeleteConversations(Array.from(selectedConvIds))}
                disabled={bulkDeletingConvs}
              >
                {bulkDeletingConvs ? <Loader2 size={16} className="crm-spin" /> : <Trash2 size={16} />}
                {bulkDeletingConvs ? 'Deleting...' : `Yes, Delete All Selected`}
              </button>
            </div>
          </div>
        </>
      )}

      {chatCallState && (
        <>
          <div className="crm-drawer-overlay" style={{ zIndex: 9999 }} onClick={handleEndChatCall} />
          <div className="crm-bulk-delete-modal" style={{ zIndex: 10000, maxWidth: '380px', textAlign: 'center' }}>
            <div style={{
              width: '72px', height: '72px', borderRadius: '50%',
              background: (chatCallState.status === 'failed' || chatCallState.status === 'ended') ? 'rgba(239,68,68,0.1)' : 'linear-gradient(135deg, #25D366, #128C7E)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
            }}>
              {chatCallState.status === 'failed' ? <XCircle size={32} style={{ color: '#ef4444' }} /> :
               chatCallState.status === 'ended' ? <PhoneOff size={32} style={{ color: '#ef4444' }} /> :
               chatCallState.status === 'permission_requested' ? <MessageCircle size={32} style={{ color: 'var(--bg-card)' }} /> :
               <PhoneIcon size={32} style={{ color: 'var(--bg-card)' }} />}
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px' }}>
              {chatCallState.status === 'checking_permission' && 'Checking permission...'}
              {chatCallState.status === 'permission_requested' && 'Permission requested'}
              {chatCallState.status === 'calling' && 'Calling...'}
              {chatCallState.status === 'ringing' && 'Ringing...'}
              {chatCallState.status === 'connected' && 'Connected'}
              {chatCallState.status === 'failed' && 'Call failed'}
              {chatCallState.status === 'ended' && 'Call ended'}
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-dark)', margin: '0 0 20px' }}>{chatCallState.phoneNumber}</p>
            {chatCallState.status === 'permission_requested' && (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-dark)', margin: '0 0 20px', lineHeight: 1.5 }}>
                A permission request was sent to this contact. They need to grant permission before you can call them. Try again after they accept.
              </p>
            )}
            {chatCallState.status === 'failed' && (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-dark)', margin: '0 0 20px', lineHeight: 1.5 }}>
                The call could not be started. Make sure WhatsApp calling is enabled for your number.
              </p>
            )}
            {chatCallState.status === 'ended' && (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-dark)', margin: '0 0 20px', lineHeight: 1.5 }}>
                The call has ended.
              </p>
            )}
            <button
              onClick={handleEndChatCall}
              style={{
                padding: '10px 32px', borderRadius: '10px', border: 'none',
                background: (chatCallState.status === 'failed' || chatCallState.status === 'ended') ? '#64748b' : '#ef4444',
                color: 'var(--bg-card)', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px', margin: '0 auto',
              }}
            >
              {chatCallState.status === 'failed' ? <X size={16} /> : chatCallState.status === 'ended' ? <X size={16} /> : <PhoneOff size={16} />}
              {chatCallState.status === 'failed' ? 'Close' : chatCallState.status === 'ended' ? 'Close' : 'End Call'}
            </button>
          </div>
        </>
      )}

      {/* Inline Lead Profile Sidebar */}
      {showLeadSidebar && selectedConv && (
        <div className="wa-lead-sidebar">
          <div className="wa-lead-sidebar-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserCheck size={18} style={{ color: '#6366F1' }} />
              <strong style={{ fontSize: '0.88rem', color: 'var(--text-main)' }}>Lead Info</strong>
            </div>
            <button
              onClick={() => setShowLeadSidebar(false)}
              aria-label="Close lead info"
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-dark)', padding: '4px', display: 'flex' }}
            >
              <X size={16} />
            </button>
          </div>
          {leadSidebarLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
              <Loader2 size={24} className="crm-spin" style={{ color: '#6366F1' }} />
            </div>
          ) : leadSidebar ? (
            <div className="wa-lead-sidebar-body">
              <div className="wa-lead-field">
                <span className="wa-lead-field-label">Name</span>
                <span className="wa-lead-field-value">{leadSidebar.full_name || 'N/A'}</span>
              </div>
              <div className="wa-lead-field">
                <span className="wa-lead-field-label">Phone</span>
                <span className="wa-lead-field-value">{leadSidebar.mobile_number || 'N/A'}</span>
              </div>
              <div className="wa-lead-field">
                <span className="wa-lead-field-label">Email</span>
                <span className="wa-lead-field-value" style={{ wordBreak: 'break-all' }}>{leadSidebar.email && leadSidebar.email !== 'N/A' ? leadSidebar.email : 'N/A'}</span>
              </div>
              <div className="wa-lead-field">
                <span className="wa-lead-field-label">State</span>
                <span className="wa-lead-field-value">{leadSidebar.state && leadSidebar.state !== 'N/A' ? leadSidebar.state : 'N/A'}</span>
              </div>
              <div className="wa-lead-field">
                <span className="wa-lead-field-label">Product</span>
                <span className="wa-lead-field-value">{leadSidebar.trading_product === 'algo' ? 'Algo' : 'TradingView Premium'}</span>
              </div>
              <div className="wa-lead-field">
                <span className="wa-lead-field-label">Status</span>
                <span className="wa-lead-field-value" style={{ textTransform: 'capitalize' }}>{leadSidebar.status.replace(/_/g, ' ')}</span>
              </div>
              {leadSidebar.fund_amount != null && (
                <div className="wa-lead-field">
                  <span className="wa-lead-field-label">Fund Amount</span>
                  <span className="wa-lead-field-value">₹{leadSidebar.fund_amount.toLocaleString('en-IN')}</span>
                </div>
              )}
              {(leadSidebar.tags && leadSidebar.tags.length > 0) && (
                <div className="wa-lead-field" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                  <span className="wa-lead-field-label">Tags</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {leadSidebar.tags.map((tag) => (
                      <span key={tag} style={{ fontSize: '0.7rem', fontWeight: 600, padding: '3px 8px', borderRadius: '5px', background: 'rgba(99,102,241,0.1)', color: '#6366F1' }}>{tag}</span>
                    ))}
                  </div>
                </div>
              )}
              {leadSidebar.notes && (
                <div className="wa-lead-field" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                  <span className="wa-lead-field-label">Notes</span>
                  <span className="wa-lead-field-value" style={{ fontSize: '0.78rem', lineHeight: 1.5, color: 'var(--text-dark)' }}>{leadSidebar.notes}</span>
                </div>
              )}
              <button
                onClick={() => setShowProfilePanel(true)}
                style={{
                  width: '100%', padding: '9px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-light)', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600,
                  cursor: 'pointer', marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                <MoreVertical size={14} /> Open Full Profile
              </button>
            </div>
          ) : (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-dark)', fontSize: '0.82rem' }}>
              <UserCheck size={32} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
              <p>No linked lead found for this conversation.</p>
              <p style={{ fontSize: '0.74rem', marginTop: '6px' }}>Open the full profile to create one.</p>
              <button
                onClick={() => setShowProfilePanel(true)}
                style={{
                  marginTop: '12px', padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-light)', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Create / View Lead
              </button>
            </div>
          )}

          {/* Internal Notes Section — always visible */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <StickyNote size={16} style={{ color: '#6366F1' }} />
              <strong style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>Internal Notes</strong>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-dark)', fontWeight: 400 }}>(team only)</span>
            </div>
            {convNotes.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px', maxHeight: '240px', overflowY: 'auto' }}>
                {convNotes.map((note) => (
                  <div key={note.id} style={{ background: 'var(--bg-light)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '8px 10px', position: 'relative' }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', paddingRight: '20px' }}>{note.body}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                      <span style={{ fontSize: '0.66rem', color: 'var(--text-dark)' }}>
                        {note.author_name ? `${note.author_name} - ` : ''}{formatTime(note.created_at)}
                      </span>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        type="button"
                        aria-label="Delete note"
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-dark)', padding: '2px', display: 'flex' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {convNotes.length === 0 && (
              <p style={{ fontSize: '0.74rem', color: 'var(--text-dark)', marginBottom: '8px' }}>No notes yet. Add context for your team below.</p>
            )}
            <div style={{ display: 'flex', gap: '6px' }}>
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a private note..."
                rows={2}
                style={{ flex: 1, fontSize: '0.78rem', padding: '6px 10px', border: '1px solid var(--border-subtle)', borderRadius: '6px', resize: 'none', outline: 'none', color: 'var(--text-main)', fontFamily: 'inherit' }}
              />
              <button
                onClick={handleAddNote}
                disabled={!newNote.trim() || savingNote}
                type="button"
                style={{ alignSelf: 'flex-end', padding: '6px 12px', borderRadius: '6px', border: 'none', background: newNote.trim() ? '#6366F1' : 'var(--border-subtle)', color: 'var(--bg-card)', fontSize: '0.76rem', fontWeight: 600, cursor: newNote.trim() && !savingNote ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.15s' }}
              >
                {savingNote ? <Loader2 size={14} className="crm-spin" /> : <Plus size={14} />} Add
              </button>
            </div>
          </div>
        </div>
      )}

      {showProfilePanel && selectedConversation && (
        <ChatProfilePanel
          convId={selectedConversation.id}
          tableName="wa_conversations"
          displayName={selectedConversation.wa_name || selectedConversation.wa_phone_number || 'Unknown'}
          phoneNumber={selectedConversation.wa_phone_number}
          profilePicUrl={selectedConversation.profile_pic_url}
          lastMessageAt={selectedConversation.last_message_at}
          onClose={() => setShowProfilePanel(false)}
          onCallFromDrawer={onCall}
          stages={DEFAULT_PIPELINE_STAGES}
        />
      )}
    </div>
  );
}

// ===================== Templates Page =====================
const PREBUILT_TEMPLATES: Omit<EmailTemplate, 'id' | 'user_id' | 'created_at' | 'updated_at'>[] = [
  {
    name: 'Telegram Channel Invite',
    subject: 'Join Our Exclusive Telegram Channel',
    body: `Hi {{name}},

Thank you for your interest in LeadCentre! We're excited to invite you to join our exclusive Telegram channel where we share:

- Real-time trading signals and market updates
- Algo trading strategies and backtest results
- TradingView premium indicator tutorials
- Live Q&A sessions with our experts

Join our Telegram channel here: {{telegram_link}}

Don't miss out on daily market insights and trading tips from our community of 5000+ traders.

Best regards,
The LeadCentre Team`,
    category: 'telegram_join',
    is_prebuilt: true,
    is_active: true,
  },
  {
    name: 'Telegram Group Welcome',
    subject: 'Welcome to Our Telegram Trading Community!',
    body: `Hello {{name}},

Welcome to the LeadCentre Telegram trading community! We're thrilled to have you on board.

Here's what you can expect:
- Daily market analysis and trade setups
- Exclusive access to our algo trading bots
- TradingView premium charts and indicators
- Direct access to our trading experts

Click here to join: {{telegram_link}}

Once you join, introduce yourself and feel free to ask any questions. Our team is always ready to help.

Happy Trading!
The LeadCentre Team`,
    category: 'telegram_join',
    is_prebuilt: true,
    is_active: true,
  },
  {
    name: 'Telegram Channel Reminder',
    subject: 'Reminder: Join Our Telegram Channel Today',
    body: `Hi {{name}},

This is a quick reminder to join our Telegram channel if you haven't already.

Our community is growing fast and we don't want you to miss out on:
- Live trading calls and signals
- Market news and analysis
- Educational content for traders at all levels

Join now: {{telegram_link}}

See you on the other side!
The LeadCentre Team`,
    category: 'telegram_join',
    is_prebuilt: true,
    is_active: true,
  },
  {
    name: 'Welcome Email',
    subject: 'Welcome to LeadCentre - Let\'s Get Started!',
    body: `Hi {{name}},

Welcome to LeadCentre! We're excited to have you as part of our growing community of traders.

Here's what you can do next:
1. Join our Telegram channel for daily signals: {{telegram_link}}
2. Explore our algo trading products
3. Check out our TradingView premium indicators

If you have any questions, just reply to this email or reach out on Telegram. We're here to help you succeed.

Best regards,
The LeadCentre Team`,
    category: 'welcome',
    is_prebuilt: true,
    is_active: true,
  },
  {
    name: 'Follow-Up - Interested Lead',
    subject: 'Following Up on Your Interest in LeadCentre',
    body: `Hi {{name}},

I hope you're doing well! I wanted to follow up on your interest in our trading products.

Based on your enquiry about {{product}}, I think you'd benefit greatly from:
- Our automated algo trading system
- Real-time signals on our Telegram channel: {{telegram_link}}
- Personal guidance from our trading experts

Would you be available for a quick call this week to discuss how we can help you get started?

Looking forward to hearing from you.

Best regards,
The LeadCentre Team`,
    category: 'follow_up',
    is_prebuilt: true,
    is_active: true,
  },
  {
    name: 'Conversion - Special Offer',
    subject: 'Special Offer Just for You - Don\'t Miss Out!',
    body: `Hi {{name}},

As a valued lead, we have a special offer just for you!

For a limited time, we're offering:
- Discounted access to our premium algo trading tools
- Free 1-on-1 onboarding session with our experts
- Exclusive access to our private Telegram group: {{telegram_link}}

This offer is only valid for the next 48 hours, so don't miss out!

Reply to this email or call us to claim your offer.

Best regards,
The LeadCentre Team`,
    category: 'conversion',
    is_prebuilt: true,
    is_active: true,
  },
];

const TEMPLATE_CATEGORIES: { key: string; label: string; color: string }[] = [
  { key: 'all', label: 'All Templates', color: '#EAB308' },
  { key: 'telegram_join', label: 'Telegram Channel Joining', color: '#0088cc' },
  { key: 'welcome', label: 'Welcome', color: '#16a34a' },
  { key: 'follow_up', label: 'Follow Up', color: '#f97316' },
  { key: 'conversion', label: 'Conversion', color: '#eab308' },
  { key: 'custom', label: 'Custom', color: '#EAB308' },
];

export function TemplatesPage({ session, onBack, embedded }: { session: Session; onBack: () => void; embedded?: boolean }) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [showPreview, setShowPreview] = useState<EmailTemplate | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<EmailTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [prebuiltImported, setPrebuiltImported] = useState(false);

  // Editor form state
  const [formName, setFormName] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formCategory, setFormCategory] = useState<EmailTemplate['category']>('custom');

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from('email_templates')
      .select('*')
      .order('is_prebuilt', { ascending: false })
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }
    setTemplates((data || []) as EmailTemplate[]);
    const hasPrebuilt = (data || []).some((t: EmailTemplate) => t.is_prebuilt);
    setPrebuiltImported(hasPrebuilt);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const filteredTemplates = useMemo(() => {
    let result = templates;
    if (activeCategory !== 'all') {
      result = result.filter((t) => t.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((t) =>
        t.name.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.body.toLowerCase().includes(q)
      );
    }
    return result;
  }, [templates, activeCategory, searchQuery]);

  const openNewEditor = () => {
    setEditingTemplate(null);
    setFormName('');
    setFormSubject('');
    setFormBody('');
    setFormCategory('custom');
    setShowEditor(true);
    setError('');
    setSaved(false);
  };

  const openEditEditor = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setFormName(template.name);
    setFormSubject(template.subject);
    setFormBody(template.body);
    setFormCategory(template.category);
    setShowEditor(true);
    setError('');
    setSaved(false);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formSubject.trim() || !formBody.trim()) {
      setError('Name, subject, and body are all required.');
      return;
    }
    setSaving(true);
    setError('');

    try {
      if (editingTemplate) {
        const { error: updateError } = await supabase
          .from('email_templates')
          .update({
            name: formName.trim(),
            subject: formSubject.trim(),
            body: formBody.trim(),
            category: formCategory,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingTemplate.id);

        if (updateError) {
          setError(updateError.message);
          setSaving(false);
          return;
        }
      } else {
        const { error: insertError } = await supabase
          .from('email_templates')
          .insert({
            user_id: session.user.id,
            name: formName.trim(),
            subject: formSubject.trim(),
            body: formBody.trim(),
            category: formCategory,
            is_prebuilt: false,
            is_active: true,
          });

        if (insertError) {
          setError(insertError.message);
          setSaving(false);
          return;
        }
      }

      setSaved(true);
      setSaving(false);
      setTimeout(() => {
        setShowEditor(false);
        setSaved(false);
      }, 1200);
      fetchTemplates();
    } catch {
      setError('Failed to save template');
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) return;
    setDeleting(true);
    const { error: delError } = await supabase
      .from('email_templates')
      .delete()
      .eq('id', showDeleteConfirm.id);
    setDeleting(false);
    if (delError) {
      setError(delError.message);
      return;
    }
    setTemplates((prev) => prev.filter((t) => t.id !== showDeleteConfirm.id));
    setShowDeleteConfirm(null);
  };

  const handleToggleActive = async (template: EmailTemplate) => {
    const newActive = !template.is_active;
    setTemplates((prev) => prev.map((t) => t.id === template.id ? { ...t, is_active: newActive } : t));
    await supabase
      .from('email_templates')
      .update({ is_active: newActive })
      .eq('id', template.id);
  };

  const handleImportPrebuilt = async () => {
    setSaving(true);
    setError('');
    try {
      const toInsert = PREBUILT_TEMPLATES.map((t) => ({
        user_id: session.user.id,
        name: t.name,
        subject: t.subject,
        body: t.body,
        category: t.category,
        is_prebuilt: true,
        is_active: true,
      }));

      const { error: insertError } = await supabase
        .from('email_templates')
        .upsert(toInsert, { onConflict: 'user_id,name', ignoreDuplicates: true });

      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }

      fetchTemplates();
      setSaving(false);
    } catch {
      setError('Failed to import pre-built templates');
      setSaving(false);
    }
  };

  const handleDuplicate = async (template: EmailTemplate) => {
    const copyName = `${template.name} (Copy)`;
    const { error: insertError } = await supabase
      .from('email_templates')
      .insert({
        user_id: session.user.id,
        name: copyName,
        subject: template.subject,
        body: template.body,
        category: 'custom',
        is_prebuilt: false,
        is_active: true,
      });

    if (insertError) {
      setError(insertError.message);
      return;
    }
    fetchTemplates();
  };

  const handleCopyBody = (template: EmailTemplate) => {
    const fullText = `Subject: ${template.subject}\n\n${template.body}`;
    navigator.clipboard?.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getCategoryColor = (category: string) => {
    const cat = TEMPLATE_CATEGORIES.find((c) => c.key === category);
    return cat?.color || '#64748b';
  };

  const renderBodyPreview = (body: string) => {
    return body.split('\n').slice(0, 3).join(' ') + (body.split('\n').length > 3 ? '...' : '');
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '4px' }}>Email Templates</h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-dark)' }}>Create, manage, and use email templates — including pre-built Telegram channel joining templates</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {!embedded && (
            <button
              onClick={onBack}
              style={{
                padding: '9px 16px', border: '1px solid var(--border-subtle)', borderRadius: '8px',
                background: 'var(--bg-card)', color: 'var(--text-dark)', fontSize: '0.85rem', fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >
              <ArrowLeft size={16} /> Back
            </button>
          )}
          {!prebuiltImported && (
            <button
              onClick={handleImportPrebuilt}
              disabled={saving}
              style={{
                padding: '9px 16px', border: 'none', borderRadius: '8px',
                background: 'linear-gradient(135deg, #FEF08A, #EAB308)', color: 'var(--bg-card)',
                fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >
              {saving ? <Loader2 size={16} className="crm-spin" /> : <Zap size={16} />}
              Import Pre-built Templates
            </button>
          )}
          <button
            onClick={openNewEditor}
            style={{
              padding: '9px 16px', border: 'none', borderRadius: '8px',
              background: '#EAB308', color: 'var(--bg-card)', fontSize: '0.85rem', fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            <Plus size={16} /> New Template
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {TEMPLATE_CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            style={{
              padding: '7px 14px', border: 'none', borderRadius: '20px',
              background: activeCategory === cat.key ? cat.color : 'var(--bg-light)',
              color: activeCategory === cat.key ? '#fff' : 'var(--text-dark)',
              fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px',
              transition: 'all 0.2s',
            }}
          >
            {cat.label}
            {activeCategory === cat.key && (
              <span style={{ background: 'rgba(255,255,255,0.2)', padding: '1px 7px', borderRadius: '10px', fontSize: '0.72rem' }}>
                {activeCategory === 'all' ? templates.length : templates.filter((t) => t.category === cat.key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ marginBottom: '20px', position: 'relative' }}>
        <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dark)' }} />
        <input
          type="text"
          placeholder="Search templates by name, subject, or content..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%', padding: '11px 16px 11px 44px', border: '1px solid var(--border-subtle)',
            borderRadius: '10px', fontSize: '0.88rem', outline: 'none',
            transition: 'border-color 0.2s', fontFamily: 'inherit',
          }}
          onFocus={(e) => { e.target.style.borderColor = '#EAB308'; }}
          onBlur={(e) => { e.target.style.borderColor = 'var(--border-subtle)'; }}
        />
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '12px 16px', color: '#dc2626', fontSize: '0.85rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
          <Loader2 size={32} className="crm-spin" style={{ color: '#EAB308' }} />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-subtle)' }}>
          <FileTextIcon size={48} style={{ color: 'var(--text-dark)', marginBottom: '16px' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
            {templates.length === 0 ? 'No templates yet' : 'No templates match your search'}
          </h3>
          <p style={{ color: 'var(--text-dark)', fontSize: '0.88rem', marginBottom: '20px', maxWidth: '400px', margin: '0 auto 20px' }}>
            {templates.length === 0
              ? 'Get started by importing our pre-built templates or create your own from scratch.'
              : 'Try adjusting your search or category filter.'}
          </p>
          {templates.length === 0 && (
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {!prebuiltImported && (
                <button
                  onClick={handleImportPrebuilt}
                  disabled={saving}
                  style={{
                    padding: '10px 20px', border: 'none', borderRadius: '10px',
                    background: 'linear-gradient(135deg, #FEF08A, #EAB308)', color: 'var(--bg-card)',
                    fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '8px',
                  }}
                >
                  {saving ? <Loader2 size={18} className="crm-spin" /> : <Zap size={18} />}
                  Import Pre-built Templates
                </button>
              )}
              <button
                onClick={openNewEditor}
                style={{
                  padding: '10px 20px', border: 'none', borderRadius: '10px',
                  background: '#EAB308', color: 'var(--bg-card)', fontSize: '0.88rem', fontWeight: 600,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                }}
              >
                <Plus size={18} /> Create Template
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              style={{
                background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border-subtle)',
                overflow: 'hidden', transition: 'box-shadow 0.2s', position: 'relative',
                opacity: template.is_active ? 1 : 0.6,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
            >
              {/* Category bar */}
              <div style={{ height: '4px', background: getCategoryColor(template.category) }} />

              <div style={{ padding: '18px' }}>
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {template.name}
                      </h3>
                      {template.is_prebuilt && (
                        <span style={{ background: 'rgba(234,179,8,0.12)', color: '#CA8A04', fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', whiteSpace: 'nowrap' }}>
                          PRE-BUILT
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-dark)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {template.subject}
                    </p>
                  </div>
                </div>

                {/* Body preview */}
                <div style={{
                  fontSize: '0.8rem', color: 'var(--text-dark)', lineHeight: 1.5,
                  marginBottom: '14px', padding: '10px 12px', background: 'var(--bg-light)',
                  borderRadius: '8px', border: '1px solid var(--border-subtle)',
                  maxHeight: '80px', overflow: 'hidden',
                }}>
                  {renderBodyPreview(template.body)}
                </div>

                {/* Category badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
                  <span style={{
                    background: `${getCategoryColor(template.category)}15`,
                    color: getCategoryColor(template.category),
                    fontSize: '0.72rem', fontWeight: 600, padding: '3px 10px', borderRadius: '12px',
                  }}>
                    {TEMPLATE_CATEGORIES.find((c) => c.key === template.category)?.label || template.category}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dark)' }}>
                    {formatDate(template.created_at)}
                  </span>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setShowPreview(template)}
                    style={{
                      flex: 1, padding: '7px 10px', border: '1px solid var(--border-subtle)', borderRadius: '7px',
                      background: 'var(--bg-card)', color: 'var(--text-dark)', fontSize: '0.76rem', fontWeight: 600,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                    }}
                  >
                    <Eye size={14} /> Preview
                  </button>
                  <button
                    onClick={() => openEditEditor(template)}
                    style={{
                      flex: 1, padding: '7px 10px', border: '1px solid var(--border-subtle)', borderRadius: '7px',
                      background: 'var(--bg-card)', color: 'var(--text-dark)', fontSize: '0.76rem', fontWeight: 600,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                    }}
                  >
                    <Edit3 size={14} /> Edit
                  </button>
                  <button
                    onClick={() => handleCopyBody(template)}
                    style={{
                      padding: '7px 10px', border: '1px solid var(--border-subtle)', borderRadius: '7px',
                      background: 'var(--bg-card)', color: 'var(--text-dark)', fontSize: '0.76rem', fontWeight: 600,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                    }}
                    title="Copy to clipboard"
                  >
                    {copied ? <Check size={14} style={{ color: '#16a34a' }} /> : <Copy size={14} />}
                  </button>
                  <button
                    onClick={() => handleDuplicate(template)}
                    style={{
                      padding: '7px 10px', border: '1px solid var(--border-subtle)', borderRadius: '7px',
                      background: 'var(--bg-card)', color: 'var(--text-dark)', fontSize: '0.76rem', fontWeight: 600,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                    }}
                    title="Duplicate"
                  >
                    <FileTextIcon size={14} />
                  </button>
                  <button
                    onClick={() => handleToggleActive(template)}
                    style={{
                      padding: '7px 10px', border: '1px solid var(--border-subtle)', borderRadius: '7px',
                      background: template.is_active ? 'rgba(22,163,74,0.08)' : 'var(--bg-card)',
                      color: template.is_active ? '#16a34a' : 'var(--text-dark)',
                      fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    title={template.is_active ? 'Active' : 'Inactive'}
                  >
                    {template.is_active ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(template)}
                    style={{
                      padding: '7px 10px', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '7px',
                      background: 'var(--bg-card)', color: '#dc2626', fontSize: '0.76rem', fontWeight: 600,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
            overflowY: 'auto',
          }}
          onClick={() => { if (!saving) setShowEditor(false); }}
        >
          <div
            style={{
              background: 'var(--bg-card)', borderRadius: '16px', maxWidth: '700px', width: '100%',
              maxHeight: '90vh', overflowY: 'auto', padding: '28px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
                {editingTemplate ? 'Edit Template' : 'New Email Template'}
              </h2>
              <button
                onClick={() => { if (!saving) setShowEditor(false); }}
                style={{ border: 'none', background: 'var(--bg-light)', borderRadius: '8px', padding: '8px', cursor: 'pointer', color: 'var(--text-dark)' }}
              >
                <X size={20} />
              </button>
            </div>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', color: '#dc2626', fontSize: '0.82rem', fontWeight: 600, marginBottom: '16px' }}>
                {error}
              </div>
            )}

            {saved && (
              <div style={{ background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.3)', borderRadius: '8px', padding: '10px 14px', color: '#16a34a', fontSize: '0.82rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} /> Template saved successfully.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>Template Name <em style={{ color: '#dc2626', fontStyle: 'normal' }}>*</em></span>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Welcome Email, Follow-up Reminder..."
                  style={{
                    padding: '10px 14px', border: '1px solid var(--border-subtle)', borderRadius: '8px',
                    fontSize: '0.88rem', outline: 'none', fontFamily: 'inherit',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#EAB308'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--border-subtle)'; }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>Category</span>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as EmailTemplate['category'])}
                  style={{
                    padding: '10px 14px', border: '1px solid var(--border-subtle)', borderRadius: '8px',
                    fontSize: '0.88rem', outline: 'none', fontFamily: 'inherit', background: 'var(--bg-card)',
                  }}
                >
                  <option value="custom">Custom</option>
                  <option value="telegram_join">Telegram Channel Joining</option>
                  <option value="welcome">Welcome</option>
                  <option value="follow_up">Follow Up</option>
                  <option value="conversion">Conversion</option>
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>Subject Line <em style={{ color: '#dc2626', fontStyle: 'normal' }}>*</em></span>
                <input
                  type="text"
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                  placeholder="Email subject line..."
                  style={{
                    padding: '10px 14px', border: '1px solid var(--border-subtle)', borderRadius: '8px',
                    fontSize: '0.88rem', outline: 'none', fontFamily: 'inherit',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#EAB308'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--border-subtle)'; }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Email Body <em style={{ color: '#dc2626', fontStyle: 'normal' }}>*</em>
                </span>
                <small style={{ fontSize: '0.74rem', color: 'var(--text-dark)' }}>
                  Use placeholders like {'{{name}}'}, {'{{telegram_link}}'}, {'{{product}}'} — they'll be replaced when sending.
                </small>
                <textarea
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  rows={12}
                  placeholder="Write your email content here..."
                  style={{
                    padding: '12px 14px', border: '1px solid var(--border-subtle)', borderRadius: '8px',
                    fontSize: '0.85rem', outline: 'none', fontFamily: 'inherit',
                    resize: 'vertical', lineHeight: 1.6,
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#EAB308'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--border-subtle)'; }}
                />
              </label>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { if (!saving) setShowEditor(false); }}
                disabled={saving}
                style={{
                  padding: '10px 18px', border: '1px solid var(--border-subtle)', borderRadius: '8px',
                  background: 'var(--bg-card)', color: 'var(--text-dark)', fontSize: '0.85rem', fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '10px 18px', border: 'none', borderRadius: '8px',
                  background: '#EAB308', color: 'var(--bg-card)', fontSize: '0.85rem', fontWeight: 600,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                }}
              >
                {saving ? <Loader2 size={18} className="crm-spin" /> : <Save size={18} />}
                {saving ? 'Saving...' : editingTemplate ? 'Update Template' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
            overflowY: 'auto',
          }}
          onClick={() => setShowPreview(null)}
        >
          <div
            style={{
              background: 'var(--bg-card)', borderRadius: '16px', maxWidth: '640px', width: '100%',
              maxHeight: '90vh', overflowY: 'auto', padding: '28px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>Template Preview</h2>
              <button
                onClick={() => setShowPreview(null)}
                style={{ border: 'none', background: 'var(--bg-light)', borderRadius: '8px', padding: '8px', cursor: 'pointer', color: 'var(--text-dark)' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <span style={{
                background: `${getCategoryColor(showPreview.category)}15`,
                color: getCategoryColor(showPreview.category),
                fontSize: '0.74rem', fontWeight: 600, padding: '4px 12px', borderRadius: '12px',
              }}>
                {TEMPLATE_CATEGORIES.find((c) => c.key === showPreview.category)?.label || showPreview.category}
              </span>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <strong style={{ fontSize: '0.78rem', color: 'var(--text-dark)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Template Name</strong>
              <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>{showPreview.name}</p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <strong style={{ fontSize: '0.78rem', color: 'var(--text-dark)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Subject</strong>
              <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', margin: 0, padding: '10px 14px', background: 'var(--bg-light)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                {showPreview.subject}
              </p>
            </div>

            <div>
              <strong style={{ fontSize: '0.78rem', color: 'var(--text-dark)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Body</strong>
              <div style={{
                padding: '16px', background: 'var(--bg-light)', borderRadius: '10px', border: '1px solid var(--border-subtle)',
                fontSize: '0.88rem', lineHeight: 1.7, color: 'var(--text-muted)', whiteSpace: 'pre-wrap',
              }}>
                {showPreview.body}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => handleCopyBody(showPreview)}
                style={{
                  padding: '10px 18px', border: '1px solid var(--border-subtle)', borderRadius: '8px',
                  background: 'var(--bg-card)', color: 'var(--text-dark)', fontSize: '0.85rem', fontWeight: 600,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                }}
              >
                {copied ? <Check size={16} style={{ color: '#16a34a' }} /> : <Copy size={16} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={() => { setShowPreview(null); openEditEditor(showPreview); }}
                style={{
                  padding: '10px 18px', border: 'none', borderRadius: '8px',
                  background: '#EAB308', color: 'var(--bg-card)', fontSize: '0.85rem', fontWeight: 600,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                }}
              >
                <Edit3 size={16} /> Edit Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
          }}
          onClick={() => { if (!deleting) setShowDeleteConfirm(null); }}
        >
          <div
            style={{
              background: 'var(--bg-card)', borderRadius: '16px', maxWidth: '420px', width: '100%', padding: '28px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Trash2 size={24} style={{ color: '#dc2626' }} />
            </div>
            <h3 style={{ textAlign: 'center', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>Delete Template?</h3>
            <p style={{ textAlign: 'center', fontSize: '0.88rem', color: 'var(--text-dark)', marginBottom: '24px' }}>
              Are you sure you want to delete "{showDeleteConfirm.name}"? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => setShowDeleteConfirm(null)}
                disabled={deleting}
                style={{
                  padding: '10px 20px', border: '1px solid var(--border-subtle)', borderRadius: '8px',
                  background: 'var(--bg-card)', color: 'var(--text-dark)', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  padding: '10px 20px', border: 'none', borderRadius: '8px',
                  background: '#dc2626', color: 'var(--bg-card)', fontSize: '0.88rem', fontWeight: 600,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                }}
              >
                {deleting ? <Loader2 size={16} className="crm-spin" /> : <Trash2 size={16} />}
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===================== Bulk Email Modal =====================
function BulkEmailModal({ leads, session, onClose, onComplete }: {
  leads: Lead[];
  session: Session;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [failedLeads, setFailedLeads] = useState<{ name: string; email: string; error: string }[]>([]);
  const [error, setError] = useState('');
  const [smtpReady, setSmtpReady] = useState<boolean | null>(null);
  const [fromName, setFromName] = useState('');
  const [attachments, setAttachments] = useState<EmailAttachment[]>([]);
  const [uploadError, setUploadError] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [batchPause, setBatchPause] = useState(false);
  const [batchPauseSeconds, setBatchPauseSeconds] = useState(0);
  const [failedLeadObjs, setFailedLeadObjs] = useState<Lead[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduling, setScheduling] = useState(false);
  const [scheduleSuccess, setScheduleSuccess] = useState(false);

  const leadsWithEmail = useMemo(() => leads.filter((l) => l.email), [leads]);
  const leadsWithoutEmail = leads.length - leadsWithEmail.length;

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !sending) onClose(); };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [onClose, sending]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('smtp_settings')
        .select('from_name, from_email')
        .maybeSingle();
      if (data) {
        setSmtpReady(true);
        setFromName(data.from_name || '');
      } else {
        setSmtpReady(false);
      }
    })();
  }, []);

  useEffect(() => {
    return () => {
      attachments.forEach((a) => { if (a.previewUrl) URL.revokeObjectURL(a.previewUrl); });
    };
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('email_templates')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (data) setEmailTemplates(data as EmailTemplate[]);
    })();
  }, []);

  const totalAttachmentSize = attachments.reduce((sum, a) => sum + a.file.size, 0);

  const addFiles = (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    setUploadError('');
    const newAttachments: EmailAttachment[] = [];
    let newTotal = totalAttachmentSize;
    for (const file of files) {
      if (attachments.length + newAttachments.length >= MAX_EMAIL_FILES) {
        setUploadError(`Maximum ${MAX_EMAIL_FILES} files allowed.`);
        break;
      }
      if (file.size > MAX_EMAIL_FILE_SIZE) {
        setUploadError(`"${file.name}" is too large. Max ${MAX_EMAIL_FILE_SIZE / 1024 / 1024}MB per file.`);
        continue;
      }
      if (newTotal + file.size > MAX_EMAIL_TOTAL_SIZE) {
        setUploadError(`Total attachment size cannot exceed ${MAX_EMAIL_TOTAL_SIZE / 1024 / 1024}MB.`);
        break;
      }
      newTotal += file.size;
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
      newAttachments.push({ file, previewUrl });
    }
    if (newAttachments.length > 0) {
      setAttachments((prev) => [...prev, ...newAttachments]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => {
      const next = [...prev];
      const removed = next[index];
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      next.splice(index, 1);
      return next;
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) addFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  };

  const replacePlaceholders = (text: string, lead: Lead): string => {
    return text
      .replace(/\{\{name\}\}/g, lead.full_name.split(' ')[0])
      .replace(/\{\{full_name\}\}/g, lead.full_name)
      .replace(/\{\{email\}\}/g, lead.email)
      .replace(/\{\{phone\}\}/g, lead.mobile_number)
      .replace(/\{\{state\}\}/g, lead.state)
      .replace(/\{\{product\}\}/g, lead.trading_product === 'algo' ? 'Trading Algo' : 'TradingView Premium');
  };

  const handleSendBulk = async (retryLeads?: Lead[]) => {
    const targetLeads = retryLeads || leadsWithEmail;
    if (!subject.trim() || !body.trim()) {
      setError('Subject and message body are required.');
      return;
    }
    if (targetLeads.length === 0) {
      setError('No leads to send to.');
      return;
    }

    setSending(true);
    setError('');
    setSentCount(0);
    setFailedCount(0);
    setFailedLeads([]);
    setFailedLeadObjs([]);
    setShowResults(false);

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setError('Session expired. Please sign in again.');
      setSending(false);
      return;
    }

    const signature = fromName.trim() ? `\n\nBest regards,\n${fromName.trim()}` : '';
    let successCount = 0;
    let failCount = 0;
    const failures: { name: string; email: string; error: string }[] = [];
    const failedObjs: Lead[] = [];

    const BATCH_SIZE = 70;
    const EMAIL_DELAY = 2000;
    const MAX_RETRIES = 2;
    const RETRY_DELAY = 30000;

    for (let i = 0; i < targetLeads.length; i++) {
      const lead = targetLeads[i];
      setCurrentIdx(i);

      if (i > 0 && i % BATCH_SIZE === 0) {
        setBatchPause(true);
        for (let s = 60; s > 0; s--) {
          setBatchPauseSeconds(s);
          await new Promise((r) => setTimeout(r, 1000));
        }
        setBatchPause(false);
        setBatchPauseSeconds(0);
      }

      const personalizedSubject = replacePlaceholders(subject, lead);
      const personalizedBody = replacePlaceholders(body, lead) + signature;

      let attempt = 0;
      let resolved = false;
      while (!resolved) {
        try {
          let response: Response;
          if (attachments.length > 0) {
            const formData = new FormData();
            formData.append('to', lead.email);
            formData.append('subject', personalizedSubject);
            formData.append('body', personalizedBody);
            formData.append('lead_id', lead.id);
            formData.append('is_bulk', 'true');
            for (const att of attachments) {
              formData.append('attachments', att.file, att.file.name);
            }
            response = await fetch(apiUrl, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
              body: formData,
            });
          } else {
            response = await fetch(apiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({ to: lead.email, subject: personalizedSubject, body: personalizedBody, lead_id: lead.id, is_bulk: true }),
            });
          }

          const result = await response.json();
          if (response.ok && result.success) {
            successCount++;
            resolved = true;
          } else {
            const errMsg = result.error || `Failed (${response.status})`;
            const isRateLimited = errMsg.toLowerCase().includes('ratelimit') || errMsg.toLowerCase().includes('rate') || response.status === 451;
            if (attempt < MAX_RETRIES && isRateLimited) {
              attempt++;
              await new Promise((r) => setTimeout(r, RETRY_DELAY));
              continue;
            }
            failCount++;
            failures.push({ name: lead.full_name, email: lead.email, error: errMsg });
            failedObjs.push(lead);
            resolved = true;
          }
        } catch {
          if (attempt < MAX_RETRIES) {
            attempt++;
            await new Promise((r) => setTimeout(r, RETRY_DELAY));
            continue;
          }
          failCount++;
          failures.push({ name: lead.full_name, email: lead.email, error: 'Network error' });
          failedObjs.push(lead);
          resolved = true;
        }
      }

      setSentCount(successCount);
      setFailedCount(failCount);
      setFailedLeads([...failures]);
      setFailedLeadObjs([...failedObjs]);

      if (i < targetLeads.length - 1) {
        await new Promise((r) => setTimeout(r, EMAIL_DELAY));
      }
    }

    setCurrentIdx(-1);
    setSending(false);
    setShowResults(true);
  };

  const applyTemplate = (tpl: EmailTemplate) => {
    setSubject(tpl.subject);
    setBody(tpl.body);
    setShowTemplateDropdown(false);
    setError('');
  };

  const handleSchedule = async () => {
    if (!subject.trim() || !body.trim()) {
      setError('Subject and message body are required.');
      return;
    }
    if (leadsWithEmail.length === 0) {
      setError('No leads with email addresses to send to.');
      return;
    }
    if (!scheduleDate || !scheduleTime) {
      setError('Please select a date and time for the scheduled send.');
      return;
    }

    const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`);
    if (scheduledAt.getTime() <= Date.now()) {
      setError('Scheduled time must be in the future.');
      return;
    }

    setScheduling(true);
    setError('');

    try {
      const attachmentMeta: { filename: string; content_base64: string; contentType: string }[] = [];
      for (const att of attachments) {
        const arrayBuffer = await att.file.arrayBuffer();
        attachmentMeta.push({
          filename: att.file.name,
          content_base64: btoa(String.fromCharCode(...new Uint8Array(arrayBuffer))),
          contentType: att.file.type || 'application/octet-stream',
        });
      }

      const recipientEmails = leadsWithEmail.map((l) => ({
        id: l.id,
        email: l.email,
        full_name: l.full_name,
        mobile_number: l.mobile_number,
        state: l.state,
        trading_product: l.trading_product,
      }));

      const { error: insertError } = await supabase
        .from('scheduled_emails')
        .insert({
          subject: subject.trim(),
          body: body.trim(),
          from_name: fromName.trim(),
          recipient_emails: recipientEmails,
          scheduled_at: scheduledAt.toISOString(),
          attachment_meta: attachmentMeta,
        });

      if (insertError) throw insertError;

      setScheduleSuccess(true);
      setScheduling(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule email');
      setScheduling(false);
    }
  };

  const canSend = Boolean(subject.trim() && body.trim() && !sending && smtpReady !== false && leadsWithEmail.length > 0);
  const canSchedule = Boolean(subject.trim() && body.trim() && !scheduling && smtpReady !== false && leadsWithEmail.length > 0 && scheduleDate && scheduleTime);

  return (
    <>
      <div className="crm-drawer-overlay" onClick={() => { if (!sending) onClose(); }} />
      <div className="crm-add-lead-modal" style={{ maxWidth: '680px' }}>
        <div className="crm-add-lead-header">
          <div className="crm-add-lead-title">
            <div className="crm-add-lead-icon" style={{ background: 'linear-gradient(135deg, #1e40af, #2563eb)' }}>
              <Send size={22} />
            </div>
            <div>
              <h2>Bulk Email</h2>
              <p>Sending to {leadsWithEmail.length} lead{leadsWithEmail.length !== 1 ? 's' : ''}{leadsWithoutEmail > 0 ? ` (${leadsWithoutEmail} without email skipped)` : ''}</p>
            </div>
          </div>
          <button className="crm-drawer-close" onClick={() => { if (!sending) onClose(); }} aria-label="Close" disabled={sending}>
            <X size={20} />
          </button>
        </div>

        <div className="crm-add-lead-form">
          {smtpReady === false && (
            <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px', padding: '12px 16px', color: '#d97706', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <AlertTriangle size={16} /> SMTP not configured. Go to Settings to set up your company email first.
            </div>
          )}

          {/* Progress bar */}
          {sending && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                <span>Sending emails...</span>
                <span>{sentCount + failedCount} / {leadsWithEmail.length}</span>
              </div>
              <div style={{ height: '8px', background: 'var(--border-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: '4px',
                  background: 'linear-gradient(90deg, #2563eb, #3b82f6)',
                  width: `${((sentCount + failedCount) / leadsWithEmail.length) * 100}%`,
                  transition: 'width 0.3s',
                }} />
              </div>
              {currentIdx >= 0 && !batchPause && (
                <p style={{ fontSize: '0.78rem', color: 'var(--text-dark)', marginTop: '6px' }}>
                  Sending to {leadsWithEmail[currentIdx]?.full_name || failedLeadObjs[currentIdx]?.full_name} &lt;{leadsWithEmail[currentIdx]?.email || failedLeadObjs[currentIdx]?.email}&gt;...
                </p>
              )}
              {batchPause && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', padding: '8px 12px', background: 'rgba(37,99,235,0.06)', borderRadius: '8px', border: '1px solid rgba(37,99,235,0.2)' }}>
                  <Clock size={14} style={{ color: '#2563eb' }} />
                  <span style={{ fontSize: '0.78rem', color: '#2563eb', fontWeight: 600 }}>
                    Cooling down {batchPauseSeconds}s — respecting SMTP rate limits before next batch...
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Results */}
          {scheduleSuccess && (
            <div style={{
              marginBottom: '16px', padding: '20px', borderRadius: '10px',
              background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.2)', textAlign: 'center',
            }}>
              <CheckCircle2 size={32} style={{ color: '#16a34a', marginBottom: '8px' }} />
              <strong style={{ fontSize: '0.95rem', color: '#16a34a', display: 'block', marginBottom: '4px' }}>
                Email Scheduled Successfully
              </strong>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-dark)', marginBottom: '12px' }}>
                Your email will be sent to {leadsWithEmail.length} lead{leadsWithEmail.length !== 1 ? 's' : ''} on {new Date(`${scheduleDate}T${scheduleTime}`).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}.
              </p>
              <button onClick={onComplete} style={{ padding: '8px 18px', border: 'none', borderRadius: '8px', background: '#4f46e5', color: 'var(--bg-card)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                Done
              </button>
            </div>
          )}

          {showResults && (
            <div style={{
              marginBottom: '16px', padding: '16px', borderRadius: '10px',
              background: failedCount === 0 ? 'rgba(22,163,74,0.06)' : 'rgba(245,158,11,0.06)',
              border: `1px solid ${failedCount === 0 ? 'rgba(22,163,74,0.2)' : 'rgba(245,158,11,0.3)'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                {failedCount === 0 ? <CheckCircle2 size={20} style={{ color: '#16a34a' }} /> : <AlertTriangle size={20} style={{ color: '#d97706' }} />}
                <strong style={{ fontSize: '0.95rem', color: failedCount === 0 ? '#16a34a' : '#d97706' }}>
                  {sentCount} email{sentCount !== 1 ? 's' : ''} sent successfully{failedCount > 0 ? `, ${failedCount} failed` : ''}
                </strong>
              </div>
              {failedLeads.length > 0 && (
                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {failedLeads.map((f, i) => (
                    <div key={i} style={{ fontSize: '0.78rem', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <XCircle size={14} /> {f.name} ({f.email}): {f.error}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                {failedLeadObjs.length > 0 && (
                  <button
                    onClick={() => handleSendBulk(failedLeadObjs)}
                    style={{
                      padding: '8px 18px', border: 'none', borderRadius: '8px',
                      background: '#2563eb', color: 'var(--bg-card)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '6px',
                    }}
                  >
                    <RotateCcw size={14} /> Retry Failed ({failedLeadObjs.length})
                  </button>
                )}
                <button
                  onClick={onComplete}
                  style={{
                      padding: '8px 18px', border: 'none', borderRadius: '8px',
                      background: '#4f46e5', color: 'var(--bg-card)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                    }}
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {!showResults && !scheduleSuccess && (
            <>
              {error && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', color: '#dc2626', fontSize: '0.85rem', fontWeight: 600, marginBottom: '12px' }}>
                  {error}
                </div>
              )}

              {/* Template Selector */}
              {emailTemplates.length > 0 && (
                <div style={{ marginBottom: '12px', position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setShowTemplateDropdown((v) => !v)}
                    style={{
                      width: '100%', padding: '10px 14px', border: '1px solid var(--border-subtle)', borderRadius: '8px',
                      background: 'var(--bg-light)', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileText size={16} style={{ color: '#2563eb' }} /> Use Email Template
                    </span>
                    <ChevronDown size={16} style={{ color: 'var(--text-dark)' }} />
                  </button>
                  {showTemplateDropdown && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: '4px',
                      background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                      maxHeight: '240px', overflowY: 'auto',
                    }}>
                      {emailTemplates.map((tpl) => (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => applyTemplate(tpl)}
                          style={{
                            width: '100%', padding: '10px 14px', border: 'none', background: 'none', textAlign: 'left',
                            cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)',
                            display: 'flex', flexDirection: 'column', gap: '2px',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-light)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                        >
                          <strong style={{ fontSize: '0.82rem' }}>{tpl.name}</strong>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-dark)' }}>{tpl.subject}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Recipient preview */}
              <div style={{ marginBottom: '12px', padding: '10px 14px', background: 'var(--bg-light)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dark)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                  Recipients ({leadsWithEmail.length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '60px', overflowY: 'auto' }}>
                  {leadsWithEmail.slice(0, 10).map((l) => (
                    <span key={l.id} style={{ fontSize: '0.74rem', padding: '3px 10px', background: 'var(--border-subtle)', borderRadius: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
                      {l.full_name}
                    </span>
                  ))}
                  {leadsWithEmail.length > 10 && (
                    <span style={{ fontSize: '0.74rem', padding: '3px 10px', color: 'var(--text-dark)', fontWeight: 600 }}>
                      +{leadsWithEmail.length - 10} more
                    </span>
                  )}
                </div>
              </div>

              <div className="crm-email-field">
                <label>
                  <span>Subject <em style={{ color: '#dc2626', fontStyle: 'normal' }}>*</em></span>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => { setSubject(e.target.value); setError(''); }}
                    placeholder="Email subject line"
                  />
                </label>
              </div>

              <div className="crm-email-field">
                <label>
                  <span>Message <em style={{ color: '#dc2626', fontStyle: 'normal' }}>*</em></span>
                  <small style={{ color: 'var(--text-dark)', fontSize: '0.74rem', marginBottom: '4px', display: 'block' }}>
                    Use {'{{name}}'}, {'{{full_name}}'}, {'{{email}}'}, {'{{phone}}'}, {'{{state}}'}, {'{{product}}'} as placeholders — they'll be personalized per lead.
                  </small>
                  <textarea
                    value={body}
                    onChange={(e) => { setBody(e.target.value); setError(''); }}
                    rows={8}
                    placeholder="Hi {{name}},&#10;&#10;Write your message here..."
                    style={{ fontFamily: 'inherit', resize: 'vertical' }}
                  />
                </label>
              </div>

              {/* Attachment Drop Zone */}
              <div
                ref={dragRef}
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); if (e.currentTarget === dragRef.current) setIsDragging(false); }}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${isDragging ? '#2563eb' : 'var(--text-dark)'}`,
                  borderRadius: '10px',
                  padding: '14px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: isDragging ? 'rgba(37,99,235,0.05)' : 'var(--bg-light)',
                  marginBottom: '12px',
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={ACCEPTED_EMAIL_FILE_TYPES}
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                <Paperclip size={18} style={{ color: 'var(--text-dark)', marginBottom: '4px' }} />
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, margin: 0 }}>
                  {isDragging ? 'Drop files here' : 'Attach files (optional)'}
                </p>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-dark)', margin: '4px 0 0 0' }}>
                  Max 25MB per file, 50MB total — sent with every email
                </p>
              </div>

              {/* Attachment List */}
              {attachments.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                  {attachments.map((att, index) => (
                    <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: 'var(--bg-light)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                      {att.previewUrl ? (
                        <img src={att.previewUrl} alt={att.file.name} style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--border-subtle)', borderRadius: '6px', flexShrink: 0, color: 'var(--text-muted)' }}>
                          {getFileIcon(att.file)}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ fontSize: '0.8rem', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.file.name}</strong>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-dark)' }}>{formatFileSize(att.file.size)}</span>
                      </div>
                      <button onClick={() => removeAttachment(index)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#dc2626', padding: '4px' }} aria-label="Remove attachment">
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {uploadError && (
                <p style={{ fontSize: '0.78rem', color: '#dc2626', marginBottom: '10px' }}>{uploadError}</p>
              )}

              {/* Schedule Toggle */}
              <div style={{ marginBottom: '12px', display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setScheduleMode('now')}
                  style={{
                    flex: 1, padding: '10px 14px', border: `2px solid ${scheduleMode === 'now' ? '#2563eb' : 'var(--border-subtle)'}`,
                    borderRadius: '8px', background: scheduleMode === 'now' ? 'rgba(37,99,235,0.05)' : 'var(--bg-card)',
                    fontSize: '0.82rem', fontWeight: 600, color: scheduleMode === 'now' ? '#2563eb' : 'var(--text-dark)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  }}
                >
                  <Send size={15} /> Send Now
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleMode('later')}
                  style={{
                    flex: 1, padding: '10px 14px', border: `2px solid ${scheduleMode === 'later' ? '#2563eb' : 'var(--border-subtle)'}`,
                    borderRadius: '8px', background: scheduleMode === 'later' ? 'rgba(37,99,235,0.05)' : 'var(--bg-card)',
                    fontSize: '0.82rem', fontWeight: 600, color: scheduleMode === 'later' ? '#2563eb' : 'var(--text-dark)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  }}
                >
                  <CalendarClock size={15} /> Schedule for Later
                </button>
              </div>

              {/* Schedule Date/Time Picker */}
              {scheduleMode === 'later' && (
                <div style={{ marginBottom: '12px', padding: '12px 14px', background: 'var(--bg-light)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dark)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                    Schedule Date & Time
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => { setScheduleDate(e.target.value); setError(''); }}
                      min={new Date().toISOString().split('T')[0]}
                      style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border-subtle)', borderRadius: '8px', fontSize: '0.82rem' }}
                    />
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => { setScheduleTime(e.target.value); setError(''); }}
                      style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border-subtle)', borderRadius: '8px', fontSize: '0.82rem' }}
                    />
                  </div>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-dark)', marginTop: '6px' }}>
                    Emails will be sent automatically at the scheduled time with rate-limiting to avoid SMTP limits.
                  </p>
                </div>
              )}

              {/* Send / Schedule button */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => onClose()}
                  disabled={sending || scheduling}
                  style={{
                    padding: '10px 18px', border: '1px solid var(--border-subtle)', borderRadius: '8px',
                    background: 'var(--bg-card)', color: 'var(--text-dark)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                {scheduleMode === 'now' ? (
                  <button
                    onClick={() => handleSendBulk()}
                    disabled={!canSend}
                    style={{
                      padding: '10px 20px', border: 'none', borderRadius: '8px',
                      background: canSend ? '#4f46e5' : 'var(--text-dark)', color: 'var(--bg-card)',
                      fontSize: '0.85rem', fontWeight: 600, cursor: canSend ? 'pointer' : 'not-allowed',
                      display: 'flex', alignItems: 'center', gap: '8px',
                    }}
                  >
                    {sending ? <Loader2 size={18} className="crm-spin" /> : <Send size={18} />}
                    {sending ? 'Sending...' : `Send to ${leadsWithEmail.length} Lead${leadsWithEmail.length !== 1 ? 's' : ''}`}
                  </button>
                ) : (
                  <button
                    onClick={handleSchedule}
                    disabled={!canSchedule}
                    style={{
                      padding: '10px 20px', border: 'none', borderRadius: '8px',
                      background: canSchedule ? '#2563eb' : 'var(--text-dark)', color: 'var(--bg-card)',
                      fontSize: '0.85rem', fontWeight: 600, cursor: canSchedule ? 'pointer' : 'not-allowed',
                      display: 'flex', alignItems: 'center', gap: '8px',
                    }}
                  >
                    {scheduling ? <Loader2 size={18} className="crm-spin" /> : <CalendarClock size={18} />}
                    {scheduling ? 'Scheduling...' : 'Schedule Send'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ===================== Scheduled Emails Panel (Settings) =====================
type ScheduledEmailRow = {
  id: string;
  subject: string;
  body: string;
  from_name: string | null;
  recipient_emails: Array<{ id: string; email: string; full_name: string }>;
  scheduled_at: string;
  status: 'pending' | 'sending' | 'completed' | 'cancelled' | 'partially_failed';
  sent_count: number;
  failed_count: number;
  failed_recipients: Array<{ id: string; email: string; full_name: string; error: string }>;
  created_at: string;
};

function ScheduledEmailsPanel({ session }: { session: Session }) {
  const [emails, setEmails] = useState<ScheduledEmailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('scheduled_emails')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setEmails(data as ScheduledEmailRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchEmails(); }, [fetchEmails]);

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    await supabase
      .from('scheduled_emails')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id);
    setCancellingId(null);
    fetchEmails();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('scheduled_emails').delete().eq('id', id);
    fetchEmails();
  };

  const statusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    pending: { label: 'Pending', color: '#d97706', bg: 'rgba(245,158,11,0.12)', icon: <Clock size={13} /> },
    sending: { label: 'Sending', color: '#2563eb', bg: 'rgba(37,99,235,0.12)', icon: <Loader2 size={13} className="crm-spin" /> },
    completed: { label: 'Completed', color: '#16a34a', bg: 'rgba(22,163,74,0.12)', icon: <CheckCircle2 size={13} /> },
    cancelled: { label: 'Cancelled', color: 'var(--text-dark)', bg: 'rgba(100,116,139,0.12)', icon: <XCircle size={13} /> },
    partially_failed: { label: 'Partially Failed', color: '#dc2626', bg: 'rgba(239,68,68,0.12)', icon: <AlertTriangle size={13} /> },
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Loader2 size={28} className="crm-spin" style={{ color: '#2563eb' }} /></div>;
  }

  return (
    <>
      <div className="crm-settings-card-header">
        <h2 className="crm-settings-card-title"><CalendarClock size={20} style={{ color: '#2563eb' }} /> Scheduled Emails</h2>
        <p className="crm-settings-card-desc">View and manage bulk email campaigns you've scheduled for future delivery. Emails are sent automatically at the scheduled time with rate-limiting to respect SMTP provider limits.</p>
      </div>

      {emails.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-dark)' }}>
          <CalendarClock size={40} style={{ marginBottom: '10px', opacity: 0.3 }} />
          <p style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: '4px' }}>No scheduled emails yet</p>
          <p style={{ fontSize: '0.8rem' }}>Select leads and use the Bulk Email feature to schedule an email for later.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {emails.map((email) => {
            const sc = statusConfig[email.status] || statusConfig.pending;
            const recipients = email.recipient_emails || [];
            const failedRecips = email.failed_recipients || [];
            const scheduledDate = new Date(email.scheduled_at);
            const isExpanded = expandedId === email.id;
            const canCancel = email.status === 'pending';

            return (
              <div key={email.id} style={{ background: 'var(--bg-light)', borderRadius: '10px', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                <div
                  style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
                  onClick={() => setExpandedId(isExpanded ? null : email.id)}
                >
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: sc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: sc.color, flexShrink: 0 }}>
                    {sc.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}>{email.subject}</strong>
                      <span style={{ fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', padding: '2px 8px', borderRadius: '4px', background: sc.bg, color: sc.color, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {sc.icon} {sc.label}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-dark)', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Users size={11} /> {recipients.length} recipients</span>
                      <span>•</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><CalendarClock size={11} /> {scheduledDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at {scheduledDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                      {email.sent_count > 0 && (<><span>•</span><span style={{ color: '#16a34a' }}>{email.sent_count} sent</span></>)}
                      {email.failed_count > 0 && (<><span>•</span><span style={{ color: '#dc2626' }}>{email.failed_count} failed</span></>)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    {canCancel && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleCancel(email.id); }}
                        disabled={cancellingId === email.id}
                        style={{ padding: '6px 12px', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', background: 'rgba(239,68,68,0.06)', color: '#dc2626', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        {cancellingId === email.id ? <Loader2 size={12} className="crm-spin" /> : <XCircle size={12} />} Cancel
                      </button>
                    )}
                    {(email.status === 'completed' || email.status === 'cancelled' || email.status === 'partially_failed') && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDelete(email.id); }}
                        style={{ padding: '6px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-dark)' }}
                        aria-label="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : email.id); }}
                      style={{ padding: '4px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-dark)', display: 'flex', alignItems: 'center' }}
                      aria-label="Expand"
                    >
                      <ChevronDown size={16} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border-subtle)' }}>
                    <div style={{ paddingTop: '12px' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dark)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Message Preview</div>
                      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '12px', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                        <strong style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem' }}>{email.subject}</strong>
                        <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '0.78rem', color: 'var(--text-dark)' }}>{email.body.slice(0, 500)}{email.body.length > 500 ? '...' : ''}</p>
                      </div>
                    </div>

                    {recipients.length > 0 && (
                      <div style={{ marginTop: '12px' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dark)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Recipients ({recipients.length})</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '80px', overflowY: 'auto' }}>
                          {recipients.slice(0, 20).map((r, i) => (
                            <span key={i} style={{ fontSize: '0.72rem', padding: '2px 8px', background: 'var(--border-subtle)', borderRadius: '10px', color: 'var(--text-muted)', fontWeight: 500 }}>
                              {r.full_name || r.email}
                            </span>
                          ))}
                          {recipients.length > 20 && (
                            <span style={{ fontSize: '0.72rem', padding: '2px 8px', color: 'var(--text-dark)', fontWeight: 600 }}>
                              +{recipients.length - 20} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {failedRecips.length > 0 && (
                      <div style={{ marginTop: '12px' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Failed Recipients ({failedRecips.length})</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {failedRecips.map((f, i) => (
                            <div key={i} style={{ fontSize: '0.74rem', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <XCircle size={12} /> {f.full_name || f.email}: {f.error}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ===================== Reply Templates Panel (Settings) =====================
function ReplyTemplatesPanel({ session }: { session: Session }) {
  const [templates, setTemplates] = useState<ReplyTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formChannel, setFormChannel] = useState<'telegram' | 'whatsapp' | 'email' | 'all'>('all');
  const [formCategory, setFormCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('reply_templates').select('*').order('sort_order', { ascending: true });
    if (data) setTemplates(data as ReplyTemplate[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const resetForm = () => {
    setFormTitle(''); setFormBody(''); setFormChannel('all'); setFormCategory(''); setEditingId(null); setShowEditor(false);
  };

  const handleSave = async () => {
    if (!formTitle.trim() || !formBody.trim()) return;
    setSaving(true);
    if (editingId) {
      await supabase.from('reply_templates').update({
        title: formTitle.trim(), body: formBody.trim(), channel: formChannel, category: formCategory.trim(),
        updated_at: new Date().toISOString(),
      }).eq('id', editingId);
    } else {
      await supabase.from('reply_templates').insert({
        title: formTitle.trim(), body: formBody.trim(), channel: formChannel, category: formCategory.trim(),
      });
    }
    setSaving(false);
    resetForm();
    fetch();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('reply_templates').delete().eq('id', id);
    setShowDelete(null);
    fetch();
  };

  const startEdit = (t: ReplyTemplate) => {
    setEditingId(t.id); setFormTitle(t.title); setFormBody(t.body); setFormChannel(t.channel); setFormCategory(t.category || '');
    setShowEditor(true);
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Loader2 size={28} className="crm-spin" style={{ color: '#2563eb' }} /></div>;
  }

  return (
    <>
      <div className="crm-settings-card-header">
        <h2 className="crm-settings-card-title"><ClipboardList size={20} style={{ color: '#2563eb' }} /> Reply Templates</h2>
        <p className="crm-settings-card-desc">Create reusable message snippets for quick insertion into Telegram and WhatsApp chats. Click "Templates" in the chat reply bar to use them.</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
        <button
          type="button"
          onClick={() => { resetForm(); setShowEditor(true); }}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', border: 'none', borderRadius: '8px', background: '#2563eb', color: 'var(--bg-card)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
        >
          <Plus size={16} /> New Template
        </button>
      </div>

      {showEditor && (
        <div style={{ background: 'var(--bg-light)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="text"
              placeholder="Template title (e.g., Welcome Message)"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border-subtle)', borderRadius: '8px', fontSize: '0.85rem' }}
            />
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <select
                value={formChannel}
                onChange={(e) => setFormChannel(e.target.value as 'telegram' | 'whatsapp' | 'email' | 'all')}
                style={{ padding: '8px 12px', border: '1px solid var(--border-subtle)', borderRadius: '8px', fontSize: '0.82rem', cursor: 'pointer' }}
              >
                <option value="all">All Channels</option>
                <option value="telegram">Telegram Only</option>
                <option value="whatsapp">WhatsApp Only</option>
                <option value="email">Email Only</option>
              </select>
              <input
                type="text"
                placeholder="Category (optional)"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                style={{ flex: '1', minWidth: '150px', padding: '8px 12px', border: '1px solid var(--border-subtle)', borderRadius: '8px', fontSize: '0.82rem' }}
              />
            </div>
            <textarea
              placeholder="Message body..."
              value={formBody}
              onChange={(e) => setFormBody(e.target.value)}
              rows={5}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border-subtle)', borderRadius: '8px', fontSize: '0.82rem', fontFamily: 'inherit', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={resetForm} style={{ padding: '8px 16px', border: '1px solid var(--border-subtle)', borderRadius: '8px', background: 'var(--bg-card)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button type="button" onClick={handleSave} disabled={saving || !formTitle.trim() || !formBody.trim()} style={{ padding: '8px 16px', border: 'none', borderRadius: '8px', background: '#2563eb', color: 'var(--bg-card)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {saving ? <Loader2 size={14} className="crm-spin" /> : <Save size={14} />} {editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {templates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dark)' }}>
          <ClipboardList size={36} style={{ marginBottom: '8px', opacity: 0.3 }} />
          <p style={{ fontSize: '0.85rem' }}>No reply templates yet. Create your first one to speed up chat replies.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {templates.map((t) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 16px', background: 'var(--bg-light)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <strong style={{ fontSize: '0.85rem' }}>{t.title}</strong>
                  <span style={{ fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', padding: '1px 6px', borderRadius: '4px', background: 'var(--border-subtle)', color: 'var(--text-dark)' }}>{t.channel}</span>
                  {t.category && <span style={{ fontSize: '0.72rem', color: 'var(--text-dark)' }}>{t.category}</span>}
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.body}</p>
              </div>
              <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                <button type="button" onClick={() => startEdit(t)} style={{ padding: '6px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-dark)' }} aria-label="Edit"><Edit3 size={16} /></button>
                <button type="button" onClick={() => setShowDelete(t.id)} style={{ padding: '6px', border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444' }} aria-label="Delete"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showDelete && (
        <>
          <div className="crm-drawer-overlay" onClick={() => setShowDelete(null)} />
          <div className="crm-bulk-delete-modal">
            <div className="crm-bulk-delete-icon" style={{ background: 'rgba(239,68,68,0.1)' }}><Trash2 size={32} style={{ color: '#ef4444' }} /></div>
            <h3>Delete this template?</h3>
            <p>This reply template will be permanently removed.</p>
            <div className="crm-bulk-delete-actions">
              <button className="crm-delete-cancel" onClick={() => setShowDelete(null)}>Cancel</button>
              <button className="crm-delete-confirm-btn" onClick={() => handleDelete(showDelete)}><Trash2 size={16} /> Yes, Delete</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ===================== Drip Campaigns Panel (Settings) =====================
function DripCampaignsPanel({ session }: { session: Session }) {
  const [campaigns, setCampaigns] = useState<(DripCampaign & { steps?: DripStep[]; enrollmentCount?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formChannel, setFormChannel] = useState<'email' | 'telegram' | 'whatsapp'>('email');
  const [formTrigger, setFormTrigger] = useState('new');
  const [steps, setSteps] = useState<{ step_number: number; delay_hours: number; subject: string; body: string }[]>([{ step_number: 1, delay_hours: 24, subject: '', body: '' }]);
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    const { data: camps } = await supabase.from('drip_campaigns').select('*').order('created_at', { ascending: false });
    if (!camps) { setLoading(false); return; }
    const { data: allSteps } = await supabase.from('drip_steps').select('*').order('step_number', { ascending: true });
    const { data: enrollments } = await supabase.from('drip_enrollments').select('campaign_id');
    const enrollmentCounts: Record<string, number> = {};
    (enrollments || []).forEach((e) => {
      const cid = (e as { campaign_id: string }).campaign_id;
      enrollmentCounts[cid] = (enrollmentCounts[cid] || 0) + 1;
    });
    const result = (camps as DripCampaign[]).map((c) => ({
      ...c,
      steps: (allSteps as DripStep[] || []).filter((s) => s.campaign_id === c.id),
      enrollmentCount: enrollmentCounts[c.id] || 0,
    }));
    setCampaigns(result);
    setLoading(false);
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const resetForm = () => {
    setFormName(''); setFormDesc(''); setFormChannel('email'); setFormTrigger('new');
    setSteps([{ step_number: 1, delay_hours: 24, subject: '', body: '' }]);
    setEditingId(null); setShowEditor(false);
  };

  const handleSave = async () => {
    if (!formName.trim() || steps.length === 0) return;
    setSaving(true);
    try {
      let campaignId = editingId;
      if (editingId) {
        await supabase.from('drip_campaigns').update({
          name: formName.trim(), description: formDesc.trim(), channel: formChannel,
          trigger_status: formTrigger, updated_at: new Date().toISOString(),
        }).eq('id', editingId);
        await supabase.from('drip_steps').delete().eq('campaign_id', editingId);
      } else {
        const { data: newCamp } = await supabase.from('drip_campaigns').insert({
          name: formName.trim(), description: formDesc.trim(), channel: formChannel,
          trigger_status: formTrigger, is_active: true,
        }).select().single();
        campaignId = (newCamp as { id: string } | null)?.id || null;
      }
      if (campaignId) {
        const stepRows = steps.map((s, i) => ({
          campaign_id: campaignId, step_number: i + 1, delay_hours: s.delay_hours || 24,
          subject: s.subject || '', body: s.body,
        }));
        await supabase.from('drip_steps').insert(stepRows);
      }
    } catch { /* ignore */ }
    setSaving(false);
    resetForm();
    fetchCampaigns();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('drip_campaigns').delete().eq('id', id);
    setShowDelete(null);
    fetchCampaigns();
  };

  const toggleActive = async (c: DripCampaign & { steps?: DripStep[]; enrollmentCount?: number }) => {
    await supabase.from('drip_campaigns').update({ is_active: !c.is_active, updated_at: new Date().toISOString() }).eq('id', c.id);
    fetchCampaigns();
  };

  const startEdit = (c: DripCampaign & { steps?: DripStep[]; enrollmentCount?: number }) => {
    setEditingId(c.id); setFormName(c.name); setFormDesc(c.description || ''); setFormChannel(c.channel);
    setFormTrigger(c.trigger_status || 'new');
    setSteps((c.steps || []).map((s) => ({ step_number: s.step_number, delay_hours: s.delay_hours, subject: s.subject || '', body: s.body })));
    if (steps.length === 0) setSteps([{ step_number: 1, delay_hours: 24, subject: '', body: '' }]);
    setShowEditor(true);
  };

  const addStep = () => {
    setSteps([...steps, { step_number: steps.length + 1, delay_hours: 24, subject: '', body: '' }]);
  };
  const removeStep = (idx: number) => {
    if (steps.length === 1) return;
    setSteps(steps.filter((_, i) => i !== idx));
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Loader2 size={28} className="crm-spin" style={{ color: '#2563eb' }} /></div>;
  }

  return (
    <>
      <div className="crm-settings-card-header">
        <h2 className="crm-settings-card-title"><Droplets size={20} style={{ color: '#2563eb' }} /> Drip Campaigns</h2>
        <p className="crm-settings-card-desc">Create automated message sequences that send to leads on a schedule. Each step sends after a configurable delay. Use placeholders like {'{{full_name}}'}, {'{{email}}'}, {'{{mobile_number}}'} in message bodies.</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
        <button
          type="button"
          onClick={() => { resetForm(); setShowEditor(true); }}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', border: 'none', borderRadius: '8px', background: '#2563eb', color: 'var(--bg-card)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
        >
          <Plus size={16} /> New Campaign
        </button>
      </div>

      {showEditor && (
        <div style={{ background: 'var(--bg-light)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input type="text" placeholder="Campaign name (e.g., New Lead Welcome Sequence)" value={formName} onChange={(e) => setFormName(e.target.value)} style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border-subtle)', borderRadius: '8px', fontSize: '0.85rem' }} />
            <input type="text" placeholder="Description (optional)" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border-subtle)', borderRadius: '8px', fontSize: '0.82rem' }} />
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <select value={formChannel} onChange={(e) => setFormChannel(e.target.value as 'email' | 'telegram' | 'whatsapp')} style={{ padding: '8px 12px', border: '1px solid var(--border-subtle)', borderRadius: '8px', fontSize: '0.82rem', cursor: 'pointer' }}>
                <option value="email">Email Channel</option>
                <option value="telegram">Telegram Channel</option>
                <option value="whatsapp">WhatsApp Channel</option>
              </select>
              <select value={formTrigger} onChange={(e) => setFormTrigger(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--border-subtle)', borderRadius: '8px', fontSize: '0.82rem', cursor: 'pointer' }}>
                <option value="new">Trigger: New Leads</option>
                <option value="interested">Trigger: Interested</option>
                <option value="called_responded">Trigger: Called - Responded</option>
                <option value="called_no_response">Trigger: Called - No Response</option>
                <option value="">Trigger: Manual Only</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '8px' }}>CAMPAIGN STEPS</div>
              {steps.map((s, idx) => (
                <div key={idx} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#2563eb', color: 'var(--bg-card)', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{idx + 1}</span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 600 }}>
                      Send after
                      <input type="number" min={1} value={s.delay_hours} onChange={(e) => setSteps(steps.map((st, i) => i === idx ? { ...st, delay_hours: parseInt(e.target.value) || 24 } : st))} style={{ width: '60px', padding: '4px 8px', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.78rem' }} />
                      hours
                    </label>
                    {formChannel === 'email' && (
                      <input type="text" placeholder="Email subject" value={s.subject} onChange={(e) => setSteps(steps.map((st, i) => i === idx ? { ...st, subject: e.target.value } : st))} style={{ flex: '1', padding: '4px 8px', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.78rem' }} />
                    )}
                    {steps.length > 1 && (
                      <button type="button" onClick={() => removeStep(idx)} style={{ padding: '4px', border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444' }} aria-label="Remove step"><X size={16} /></button>
                    )}
                  </div>
                  <textarea placeholder="Message body... Use {{full_name}}, {{email}}, {{mobile_number}} for personalization." value={s.body} onChange={(e) => setSteps(steps.map((st, i) => i === idx ? { ...st, body: e.target.value } : st))} rows={3} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-subtle)', borderRadius: '8px', fontSize: '0.78rem', fontFamily: 'inherit', resize: 'vertical' }} />
                </div>
              ))}
              <button type="button" onClick={addStep} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', border: '1px dashed var(--border-subtle)', borderRadius: '8px', background: 'transparent', color: 'var(--text-dark)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                <Plus size={14} /> Add Step
              </button>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={resetForm} style={{ padding: '8px 16px', border: '1px solid var(--border-subtle)', borderRadius: '8px', background: 'var(--bg-card)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button type="button" onClick={handleSave} disabled={saving || !formName.trim() || steps.some((s) => !s.body.trim())} style={{ padding: '8px 16px', border: 'none', borderRadius: '8px', background: '#2563eb', color: 'var(--bg-card)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {saving ? <Loader2 size={14} className="crm-spin" /> : <Save size={14} />} {editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {campaigns.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dark)' }}>
          <Droplets size={36} style={{ marginBottom: '8px', opacity: 0.3 }} />
          <p style={{ fontSize: '0.85rem' }}>No drip campaigns yet. Create your first automated sequence to nurture leads on autopilot.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {campaigns.map((c) => (
            <div key={c.id} style={{ background: 'var(--bg-light)', borderRadius: '10px', border: '1px solid var(--border-subtle)', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ fontSize: '0.9rem' }}>{c.name}</strong>
                    <span className={`crm-drip-badge ${c.is_active ? 'crm-drip-badge-active' : 'crm-drip-badge-inactive'}`}>
                      {c.is_active ? 'Active' : 'Paused'}
                    </span>
                    <span style={{ fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', padding: '1px 6px', borderRadius: '4px', background: 'var(--border-subtle)', color: 'var(--text-dark)' }}>{c.channel}</span>
                  </div>
                  {c.description && <p style={{ fontSize: '0.78rem', color: 'var(--text-dark)', marginTop: '2px' }}>{c.description}</p>}
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-dark)', marginTop: '4px' }}>
                    {c.steps?.length || 0} step{(c.steps?.length || 0) !== 1 ? 's' : ''} &middot; {c.enrollmentCount || 0} enrolled &middot; Trigger: {c.trigger_status || 'manual'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                  <button type="button" onClick={() => toggleActive(c)} style={{ padding: '6px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-dark)' }} aria-label="Toggle active">{c.is_active ? <BellRing size={16} /> : <Bell size={16} />}</button>
                  <button type="button" onClick={() => startEdit(c)} style={{ padding: '6px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-dark)' }} aria-label="Edit"><Edit3 size={16} /></button>
                  <button type="button" onClick={() => setShowDelete(c.id)} style={{ padding: '6px', border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444' }} aria-label="Delete"><Trash2 size={16} /></button>
                </div>
              </div>
              {c.steps && c.steps.length > 0 && (
                <div className="crm-drip-steps-list">
                  {c.steps.map((s) => (
                    <div key={s.id} className="crm-drip-step">
                      <div className="crm-drip-step-num">{s.step_number}</div>
                      <div className="crm-drip-step-info">
                        <div className="crm-drip-step-delay">+{s.delay_hours}h</div>
                        <div className="crm-drip-step-body">{s.subject ? `${s.subject}: ` : ''}{s.body}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showDelete && (
        <>
          <div className="crm-drawer-overlay" onClick={() => setShowDelete(null)} />
          <div className="crm-bulk-delete-modal">
            <div className="crm-bulk-delete-icon" style={{ background: 'rgba(239,68,68,0.1)' }}><Trash2 size={32} style={{ color: '#ef4444' }} /></div>
            <h3>Delete this campaign?</h3>
            <p>The campaign and all its steps and enrollments will be permanently removed.</p>
            <div className="crm-bulk-delete-actions">
              <button className="crm-delete-cancel" onClick={() => setShowDelete(null)}>Cancel</button>
              <button className="crm-delete-confirm-btn" onClick={() => handleDelete(showDelete)}><Trash2 size={16} /> Yes, Delete</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ===================== Delete Account Panel (Settings) =====================
function DeleteAccountPanel({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const [confirmText, setConfirmText] = useState('');
  const [step, setStep] = useState<'idle' | 'confirm' | 'deleting' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const expectedPhrase = 'DELETE MY ACCOUNT';

  const handleDelete = async () => {
    setStep('deleting');
    setErrorMsg('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setErrorMsg('Session expired. Please sign in again.');
        setStep('error');
        return;
      }

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id: session.user.id }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error (${res.status})`);
      }

      setStep('done');
      setTimeout(() => onSignOut(), 2500);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setStep('error');
    }
  };

  return (
    <>
      <div className="crm-settings-card-header">
        <h2 className="crm-settings-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Trash2 size={20} style={{ color: '#dc2626' }} /> Delete Account
        </h2>
        <p className="crm-settings-card-desc">
          Permanently delete your CRM account and all associated data, including leads, conversations, team members, settings, and integrations. This action cannot be undone.
        </p>
      </div>

      <div style={{
        background: 'rgba(239,68,68,0.06)',
        border: '1px solid rgba(239,68,68,0.25)',
        borderRadius: '12px',
        padding: '20px',
        marginTop: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
          <AlertTriangle size={22} style={{ color: '#dc2626', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#dc2626', margin: '0 0 6px 0' }}>
              Warning: This is irreversible
            </h3>
            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.82rem', color: '#7f1d1d', lineHeight: 1.7 }}>
              <li>All leads and customer data will be permanently deleted</li>
              <li>All team members will lose access immediately</li>
              <li>Telegram, WhatsApp, and email integrations will be removed</li>
              <li>Drip campaigns, follow-ups, and templates will be erased</li>
              <li>Your login credentials will no longer work</li>
            </ul>
          </div>
        </div>

        {step === 'idle' && (
          <button
            type="button"
            onClick={() => setStep('confirm')}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '12px 24px', borderRadius: '10px',
              border: '1px solid rgba(239,68,68,0.4)',
              background: 'rgba(239,68,68,0.08)',
              color: '#dc2626', fontSize: '0.85rem', fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#dc2626'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#dc2626'; }}
          >
            <Trash2 size={18} /> Delete My Account
          </button>
        )}

        {step === 'confirm' && (
          <div>
            <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
              To confirm, type <strong style={{ color: '#dc2626', letterSpacing: '0.03em' }}>{expectedPhrase}</strong> below:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={expectedPhrase}
              style={{
                width: '100%', maxWidth: '340px',
                padding: '12px 16px', border: '1.5px solid var(--border-subtle)', borderRadius: '10px',
                fontSize: '0.85rem', fontFamily: 'monospace', fontWeight: 600,
                outline: 'none', marginBottom: '16px',
              }}
            />
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleDelete}
                disabled={confirmText !== expectedPhrase}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '12px 24px', borderRadius: '10px', border: 'none',
                  background: confirmText === expectedPhrase ? '#dc2626' : 'var(--border-subtle)',
                  color: confirmText === expectedPhrase ? '#fff' : 'var(--text-dark)',
                  fontSize: '0.85rem', fontWeight: 700, cursor: confirmText === expectedPhrase ? 'pointer' : 'not-allowed',
                  transition: 'all 0.15s',
                }}
              >
                <Trash2 size={18} /> Permanently Delete
              </button>
              <button
                type="button"
                onClick={() => { setStep('idle'); setConfirmText(''); }}
                style={{
                  padding: '12px 24px', borderRadius: '10px',
                  border: '1px solid var(--border-subtle)', background: 'var(--bg-card)',
                  color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {step === 'deleting' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 0' }}>
            <Loader2 size={22} className="crm-spin" style={{ color: '#dc2626' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Deleting your account and all data...
            </span>
          </div>
        )}

        {step === 'done' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '16px', background: 'rgba(22,163,74,0.08)',
            border: '1px solid rgba(22,163,74,0.25)', borderRadius: '10px',
          }}>
            <CheckCircle2 size={20} style={{ color: '#16a34a' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#15803d' }}>
              Account deleted successfully. You will be signed out momentarily.
            </span>
          </div>
        )}

        {step === 'error' && (
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '14px 16px', background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px',
              marginBottom: '12px',
            }}>
              <AlertTriangle size={18} style={{ color: '#dc2626', flexShrink: 0 }} />
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#dc2626' }}>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => { setStep('idle'); setConfirmText(''); setErrorMsg(''); }}
              style={{
                padding: '10px 20px', borderRadius: '10px',
                border: '1px solid var(--border-subtle)', background: 'var(--bg-card)',
                color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Back
            </button>
          </div>
        )}
      </div>
    </>
  );
}
