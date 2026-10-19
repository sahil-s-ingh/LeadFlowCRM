import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import {
  ArrowLeft, Loader2, Plus, Send, Trash2, Eye, AlertTriangle,
  RefreshCw, Users, CheckCircle2, XCircle, Clock, Calendar,
  Upload, Zap, Info, ChevronRight, X, RotateCw, MessageSquare,
  CheckCheck, Timer, BarChart3, Filter, Copy, FlaskConical,
  Clock3, Gauge, MessageCircle, DollarSign, GitCompare, CalendarDays,
} from 'lucide-react';
import {
  BroadcastAnalyticsDashboard, SegmentationBuilder, QuickRecreatePanel,
  ABTestBroadcastModal, SendTimeOptimization, ThrottleControl,
  ReplyTrackingPanel, CostEstimator, CampaignComparison, BroadcastCalendarView,
  AudienceManagerPanel, OptOutManagerPanel, DripSequenceBuilder,
} from '@/components/WhatsAppBroadcastFeatures';
import { Ban, CalendarDays as CalendarDaysIcon, Users as UsersIcon } from 'lucide-react';

type WaTemplate = {
  meta_template_id: string | null;
  name: string;
  language: string;
  category: string;
  status: string;
  components: any[];
};

type BroadcastCampaign = {
  id: string;
  campaign_name?: string;
  template_name: string;
  template_language: string;
  template_components: any[];
  status: string;
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  read_count?: number;
  failed_count: number;
  created_at: string;
  scheduled_at?: string | null;
  phone_number_id?: string | null;
  variable_mapping?: Record<string, string>;
};

type BroadcastRecipient = {
  id: string;
  campaign_id: string;
  phone_number: string;
  recipient_name?: string | null;
  lead_id: string | null;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  variable_values?: Record<string, string>;
  is_manual?: boolean;
};

type PhoneNumber = {
  id: string;
  phone_number_id: string;
  phone_number_display: string | null;
  connected_phone_number: string | null;
};

const LEAD_FIELDS = [
  { value: 'full_name', label: 'Full Name' },
  { value: 'mobile_number', label: 'Mobile Number' },
  { value: 'email', label: 'Email' },
  { value: 'state', label: 'State' },
  { value: 'trading_product', label: 'Trading Product' },
  { value: 'fund_amount', label: 'Fund Amount' },
  { value: 'lead_source', label: 'Lead Source' },
  { value: 'status', label: 'Lead Status' },
];

const BATCH_DELAY_MS = 500;

// Build the final message text from template components + variable values for the preview bubble
function buildPreviewText(components: any[], variableValues: Record<string, string>): string {
  const bodyComp = components?.find((c: any) => c.type === 'BODY');
  if (!bodyComp?.text) return '(no body text)';
  let text = bodyComp.text;
  const sortedKeys = Object.keys(variableValues).sort((a, b) => parseInt(a) - parseInt(b));
  sortedKeys.forEach((k) => {
    text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), variableValues[k] || `{{${k}}}`);
  });
  // Replace any unmapped variables with placeholders
  text = text.replace(/\{\{(\d+)\}\}/g, (_, n) => `[var ${n}]`);
  return text;
}

export default function WhatsAppBroadcast({ session, onBack }: { session: Session; onBack: () => void }) {
  const [waTemplates, setWaTemplates] = useState<WaTemplate[]>([]);
  const [broadcasts, setBroadcasts] = useState<BroadcastCampaign[]>([]);
  const [broadcastsLoading, setBroadcastsLoading] = useState(false);
  const [broadcastError, setBroadcastError] = useState('');
  const [showBroadcastForm, setShowBroadcastForm] = useState(false);
  const [broadcastTplName, setBroadcastTplName] = useState('');
  const [broadcastTplLanguage, setBroadcastTplLanguage] = useState('en_US');
  const [broadcastTplComponents, setBroadcastTplComponents] = useState<any[]>([]);
  const [broadcastRecipientFilter, setBroadcastRecipientFilter] = useState<string>('all');
  const [broadcastRecipientCount, setBroadcastRecipientCount] = useState(0);
  const [broadcastCreating, setBroadcastCreating] = useState(false);
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastSendingId, setBroadcastSendingId] = useState<string | null>(null);
  const [selectedBroadcast, setSelectedBroadcast] = useState<BroadcastCampaign | null>(null);
  const [broadcastRecipients, setBroadcastRecipients] = useState<BroadcastRecipient[]>([]);
  const [broadcastRecipientsLoading, setBroadcastRecipientsLoading] = useState(false);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [selectedPhoneId, setSelectedPhoneId] = useState<string>('');
  const [campaignName, setCampaignName] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [recipientMode, setRecipientMode] = useState<'lead_filter' | 'csv'>('lead_filter');
  const [csvText, setCsvText] = useState('');
  const [csvRecipients, setCsvRecipients] = useState<{ phone_number: string; name?: string }[]>([]);
  const [variableMapping, setVariableMapping] = useState<Record<string, string>>({});
  const [previewLeads, setPreviewLeads] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<{ duplicates: number; total: number } | null>(null);
  const [duplicateChecking, setDuplicateChecking] = useState(false);

  // Feature batch state
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showSegmentBuilder, setShowSegmentBuilder] = useState(false);
  const [showQuickRecreate, setShowQuickRecreate] = useState(false);
  const [showABTest, setShowABTest] = useState(false);
  const [showSendTime, setShowSendTime] = useState(false);
  const [showReplyTracking, setShowReplyTracking] = useState(false);
  const [showCostEstimator, setShowCostEstimator] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showAudienceManager, setShowAudienceManager] = useState(false);
  const [showOptOutManager, setShowOptOutManager] = useState(false);
  const [showDripBuilder, setShowDripBuilder] = useState(false);
  const [throttleDelay, setThrottleDelay] = useState(500);
  const [segmentConditions, setSegmentConditions] = useState<{ field: string; operator: string; value: string }[]>([]);

  const fetchWaTemplates = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-templates?action=list`;
      const res = await fetch(apiUrl, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok || data.error) return;
      setWaTemplates(data.templates || []);
    } catch { /* non-fatal */ }
  }, []);

  const fetchBroadcasts = useCallback(async () => {
    setBroadcastsLoading(true);
    setBroadcastError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-broadcast?action=list`;
      const res = await fetch(apiUrl, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok || data.error) { setBroadcastError(data.error || 'Failed to load campaigns'); return; }
      setBroadcasts(data.campaigns || []);
    } catch { setBroadcastError('Failed to load campaigns'); }
    finally { setBroadcastsLoading(false); }
  }, []);

  const fetchPhoneNumbers = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-broadcast?action=get_phone_numbers`;
      const res = await fetch(apiUrl, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok || data.error) return;
      setPhoneNumbers(data.phone_numbers || []);
    } catch { /* non-fatal */ }
  }, []);

  const fetchBroadcastRecipientCount = useCallback(async (filter: string) => {
    let query = supabase.from('submissions').select('id', { count: 'exact', head: true }).is('deleted_at', null);
    if (filter !== 'all') query = query.eq('status', filter);
    const { count } = await query;
    setBroadcastRecipientCount(count || 0);
  }, []);

  useEffect(() => {
    fetchWaTemplates();
    fetchBroadcasts();
    fetchPhoneNumbers();
    fetchBroadcastRecipientCount(broadcastRecipientFilter);
  }, []);

  useEffect(() => { fetchBroadcastRecipientCount(broadcastRecipientFilter); }, [broadcastRecipientFilter, fetchBroadcastRecipientCount]);

  const fetchBroadcastRecipients = async (campaignId: string) => {
    setBroadcastRecipientsLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-broadcast?action=get&campaign_id=${campaignId}`;
      const res = await fetch(apiUrl, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok || data.error) { setBroadcastError(data.error || 'Failed to load recipients'); return; }
      setBroadcastRecipients(data.recipients || []);
      setSelectedBroadcast(data.campaign || null);
    } catch { setBroadcastError('Failed to load recipients'); }
    finally { setBroadcastRecipientsLoading(false); }
  };

  const handleSelectBroadcastTemplate = (tplName: string) => {
    const tpl = waTemplates.find((t) => t.name === tplName && t.status === 'APPROVED');
    if (!tpl) return;
    setBroadcastTplName(tpl.name);
    setBroadcastTplLanguage(tpl.language);
    setBroadcastTplComponents(tpl.components || []);
    setCampaignName(tpl.name);

    const bodyComp = tpl.components?.find((c: any) => c.type === 'BODY');
    const bodyVars = (bodyComp?.text?.match(/\{\{(\d+)\}\}/g) || []).map((m: string) => parseInt(m.match(/\d+/)![0], 10));
    const uniqueVars = [...new Set(bodyVars)].sort((a, b) => a - b);
    const defaultMapping: Record<string, string> = {};
    const defaults: Record<number, string> = { 1: 'full_name', 2: 'email', 3: 'state', 4: 'trading_product' };
    uniqueVars.forEach((v) => { defaultMapping[String(v)] = defaults[v] || 'full_name'; });
    setVariableMapping(defaultMapping);
  };

  const parseCsv = () => {
    const lines = csvText.trim().split('\n').filter(Boolean);
    const recipients: { phone_number: string; name?: string }[] = [];
    for (const line of lines) {
      const parts = line.split(',').map((s) => s.trim());
      const phone = parts[0]?.replace(/^\+/, '');
      if (!phone) continue;
      recipients.push({ phone_number: phone, name: parts[1] || undefined });
    }
    setCsvRecipients(recipients);
    return recipients;
  };

  // Duplicate check — runs when template + filter are set
  const checkDuplicates = useCallback(async () => {
    if (!broadcastTplName) { setDuplicateInfo(null); return; }
    setDuplicateChecking(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;

      // Get phone numbers for the current filter
      let phones: string[] = [];
      if (recipientMode === 'csv') {
        phones = csvRecipients.map((r) => r.phone_number);
      } else {
        let query = supabase.from('submissions').select('mobile_number').is('deleted_at', null);
        if (broadcastRecipientFilter !== 'all') query = query.eq('status', broadcastRecipientFilter);
        const { data: leads } = await query;
        phones = (leads || []).filter((l: any) => l.mobile_number?.trim()).map((l: any) => l.mobile_number.trim().replace(/^\+/, ''));
      }

      if (phones.length === 0) { setDuplicateInfo(null); setDuplicateChecking(false); return; }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-broadcast?action=check_duplicates`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ template_name: broadcastTplName, phone_numbers: phones }),
      });
      const data = await res.json();
      if (!res.ok || data.error) return;
      setDuplicateInfo({ duplicates: data.duplicates || 0, total: data.total_checked || phones.length });
    } catch { /* non-fatal */ }
    finally { setDuplicateChecking(false); }
  }, [broadcastTplName, recipientMode, csvRecipients, broadcastRecipientFilter]);

  useEffect(() => {
    if (broadcastTplName && (recipientMode === 'csv' ? csvRecipients.length > 0 : broadcastRecipientCount > 0)) {
      const timer = setTimeout(() => { checkDuplicates(); }, 600);
      return () => clearTimeout(timer);
    }
    setDuplicateInfo(null);
  }, [broadcastTplName, broadcastRecipientFilter, recipientMode, csvRecipients.length, broadcastRecipientCount, checkDuplicates]);

  const handlePreviewLeads = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-broadcast?action=preview_recipients&filter=${broadcastRecipientFilter}`;
      const res = await fetch(apiUrl, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok || data.error) return;
      setPreviewLeads(data.recipients || []);
      setShowPreview(true);
    } catch { /* non-fatal */ }
  };

  const handleCreateBroadcast = async () => {
    if (!broadcastTplName) return;
    setBroadcastCreating(true);
    setBroadcastError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;

      let recipients: { lead_id?: string; phone_number: string; name?: string; lead_data?: any }[] = [];
      if (recipientMode === 'csv') {
        const parsed = parseCsv();
        if (parsed.length === 0) { setBroadcastError('No valid phone numbers found in CSV'); setBroadcastCreating(false); return; }
        recipients = parsed.map((r) => ({ phone_number: r.phone_number, name: r.name }));
      } else {
        let query = supabase.from('submissions').select('id, full_name, mobile_number, email, state, status, trading_product, fund_amount, lead_source').is('deleted_at', null);
        if (broadcastRecipientFilter !== 'all') query = query.eq('status', broadcastRecipientFilter);
        const { data: leads } = await query;
        if (!leads || leads.length === 0) { setBroadcastError('No leads found matching the filter'); setBroadcastCreating(false); return; }
        recipients = leads.filter((l: any) => l.mobile_number && l.mobile_number.trim()).map((l: any) => ({ lead_id: l.id, phone_number: l.mobile_number.trim(), name: l.full_name, lead_data: l }));
      }
      if (recipients.length === 0) { setBroadcastError('No valid recipients found'); setBroadcastCreating(false); return; }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-broadcast?action=create`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          template_name: broadcastTplName,
          template_language: broadcastTplLanguage,
          template_components: broadcastTplComponents,
          recipients,
          campaign_name: campaignName || broadcastTplName,
          scheduled_at: scheduledAt || null,
          phone_number_id: selectedPhoneId || null,
          variable_mapping: recipientMode === 'lead_filter' ? variableMapping : {},
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { setBroadcastError(data.error || 'Failed to create broadcast'); setBroadcastCreating(false); return; }
      setShowBroadcastForm(false);
      resetForm();
      await fetchBroadcasts();
    } catch { setBroadcastError('Failed to create broadcast'); }
    finally { setBroadcastCreating(false); }
  };

  const resetForm = () => {
    setBroadcastTplName(''); setBroadcastTplComponents([]); setBroadcastRecipientFilter('all');
    setCampaignName(''); setScheduledAt(''); setSelectedPhoneId(''); setCsvText('');
    setCsvRecipients([]); setVariableMapping({}); setRecipientMode('lead_filter'); setDuplicateInfo(null);
  };

  const handleSendBroadcast = async (campaignId: string) => {
    if (!confirm('Start sending this broadcast? Messages will be sent one by one to all pending recipients.')) return;
    setBroadcastSending(true);
    setBroadcastSendingId(campaignId);
    setBroadcastError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-broadcast?action=send`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ campaign_id: campaignId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { setBroadcastError(data.error || 'Failed to send broadcast'); return; }
      await fetchBroadcasts();
      if (selectedBroadcast?.id === campaignId) await fetchBroadcastRecipients(campaignId);
    } catch { setBroadcastError('Failed to send broadcast'); }
    finally { setBroadcastSending(false); setBroadcastSendingId(null); }
  };

  const handleRetryFailed = async (campaignId: string) => {
    if (!confirm('Retry sending to all failed recipients? Messages will be re-sent one by one.')) return;
    setRetryingId(campaignId);
    setBroadcastError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-broadcast?action=send`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ campaign_id: campaignId, retry_only: true }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { setBroadcastError(data.error || 'Failed to retry'); return; }
      await fetchBroadcasts();
      if (selectedBroadcast?.id === campaignId) await fetchBroadcastRecipients(campaignId);
    } catch { setBroadcastError('Failed to retry'); }
    finally { setRetryingId(null); }
  };

  const handleCancelBroadcast = async (campaignId: string) => {
    if (!confirm('Cancel this scheduled broadcast? It will revert to draft status.')) return;
    setCancelingId(campaignId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-broadcast?action=cancel`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ campaign_id: campaignId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { setBroadcastError(data.error || 'Failed to cancel'); return; }
      await fetchBroadcasts();
    } catch { setBroadcastError('Failed to cancel'); }
    finally { setCancelingId(null); }
  };

  const handleDeleteBroadcast = async (campaignId: string) => {
    if (!confirm('Delete this broadcast campaign? This cannot be undone.')) return;
    setBroadcastError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-broadcast?action=delete`;
      const res = await fetch(apiUrl, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ campaign_id: campaignId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { setBroadcastError(data.error || 'Failed to delete campaign'); return; }
      if (selectedBroadcast?.id === campaignId) { setSelectedBroadcast(null); setBroadcastRecipients([]); }
      await fetchBroadcasts();
    } catch { setBroadcastError('Failed to delete campaign'); }
  };

  const handleSegmentApply = (conditions: { field: string; operator: string; value: string }[], count: number) => {
    setSegmentConditions(conditions);
    setShowSegmentBuilder(false);
    setShowBroadcastForm(true);
    // Override recipient filter with segment conditions — apply the first condition as the primary filter
    const firstCondition = conditions[0];
    if (firstCondition && firstCondition.field === 'status' && firstCondition.operator === 'eq') {
      setBroadcastRecipientFilter(firstCondition.value);
    } else {
      setBroadcastRecipientFilter('all');
    }
    fetchBroadcastRecipientCount(firstCondition?.field === 'status' && firstCondition.operator === 'eq' ? firstCondition.value : 'all');
  };

  const handleABTestLaunch = async (config: { name: string; variantA: string; variantB: string; split: number; recipientFilter: string }) => {
    setShowABTest(false);
    setBroadcastError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;

      // Fetch recipients
      let query = supabase.from('submissions').select('id, full_name, mobile_number, email, state, status, trading_product, fund_amount, lead_source').is('deleted_at', null);
      if (config.recipientFilter !== 'all') query = query.eq('status', config.recipientFilter);
      const { data: leads } = await query;
      if (!leads || leads.length === 0) { setBroadcastError('No leads found for A/B test'); return; }

      const validLeads = leads.filter((l: any) => l.mobile_number?.trim());
      const splitIdx = Math.floor(validLeads.length * (config.split / 100));
      const groupA = validLeads.slice(0, splitIdx);
      const groupB = validLeads.slice(splitIdx);

      const tplA = waTemplates.find((t) => t.name === config.variantA && t.status === 'APPROVED');
      const tplB = waTemplates.find((t) => t.name === config.variantB && t.status === 'APPROVED');
      if (!tplA || !tplB) { setBroadcastError('Could not find approved templates for both variants'); return; }

      // Create campaign A
      const resA = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-broadcast?action=create`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ template_name: config.variantA, template_language: tplA.language, template_components: tplA.components, recipients: groupA.map((l: any) => ({ lead_id: l.id, phone_number: l.mobile_number.trim(), name: l.full_name, lead_data: l })), campaign_name: `${config.name} - Variant A`, phone_number_id: selectedPhoneId || null, variable_mapping: {} }),
      });
      const dataA = await resA.json();

      // Create campaign B
      const resB = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-broadcast?action=create`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ template_name: config.variantB, template_language: tplB.language, template_components: tplB.components, recipients: groupB.map((l: any) => ({ lead_id: l.id, phone_number: l.mobile_number.trim(), name: l.full_name, lead_data: l })), campaign_name: `${config.name} - Variant B`, phone_number_id: selectedPhoneId || null, variable_mapping: {} }),
      });
      const dataB = await resB.json();

      // Save A/B test record
      await supabase.from('wa_broadcast_ab_tests').insert({
        name: config.name, variant_a_template: config.variantA, variant_b_template: config.variantB,
        split_percentage: config.split, recipient_filter: config.recipientFilter,
        campaign_a_id: dataA.campaign?.id, campaign_b_id: dataB.campaign?.id, status: 'draft',
      });

      await fetchBroadcasts();
      setBroadcastError('A/B test created! Two draft campaigns have been created — send both to start the test.');
    } catch { setBroadcastError('Failed to create A/B test'); }
  };

  const handleRecreatePreset = (preset: any) => {
    setShowQuickRecreate(false);
    resetForm();
    setShowBroadcastForm(true);
    setBroadcastTplName(preset.template_name);
    setBroadcastTplLanguage(preset.template_language || 'en_US');
    setBroadcastTplComponents(preset.template_components || []);
    setCampaignName(preset.name);
    setVariableMapping(preset.variable_mapping || {});
    if (preset.phone_number_id) setSelectedPhoneId(preset.phone_number_id);
    const bodyComp = (preset.template_components || []).find((c: any) => c.type === 'BODY');
    const bodyVars = (bodyComp?.text?.match(/\{\{(\d+)\}\}/g) || []).map((m: string) => parseInt(m.match(/\d+/)![0], 10));
    const uniqueVars = [...new Set(bodyVars)].sort((a, b) => a - b);
    const defaultMapping: Record<string, string> = {};
    const defaults: Record<number, string> = { 1: 'full_name', 2: 'email', 3: 'state', 4: 'trading_product' };
    uniqueVars.forEach((v) => { defaultMapping[String(v)] = (preset.variable_mapping || {})[String(v)] || defaults[v] || 'full_name'; });
    setVariableMapping(defaultMapping);
  };

  const handleSendTimeApply = (time: string) => {
    setShowSendTime(false);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const [hours, minutes] = time.split(':');
    tomorrow.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    const localISOString = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setScheduledAt(localISOString);
    if (!showBroadcastForm) setShowBroadcastForm(true);
  };

  const approvedTemplates = waTemplates.filter((t) => t.status === 'APPROVED');
  const aggregateStats = broadcasts.reduce((acc, c) => {
    acc.total += c.total_recipients; acc.sent += c.sent_count; acc.delivered += c.delivered_count;
    acc.failed += c.failed_count; acc.read += (c.read_count || 0); return acc;
  }, { total: 0, sent: 0, delivered: 0, failed: 0, read: 0 });

  const statusConfig: Record<string, { bg: string; color: string; icon: React.ReactNode; label: string }> = {
    completed: { bg: 'rgba(22,163,74,0.12)', color: '#16a34a', icon: <CheckCircle2 size={13} />, label: 'Completed' },
    sending: { bg: 'rgba(59,130,246,0.12)', color: '#2563eb', icon: <Loader2 size={13} className="crm-spin" />, label: 'Sending' },
    failed: { bg: 'rgba(239,68,68,0.12)', color: '#dc2626', icon: <XCircle size={13} />, label: 'Failed' },
    draft: { bg: 'rgba(234,179,8,0.12)', color: '#854d0e', icon: <Clock size={13} />, label: 'Draft' },
    scheduled: { bg: 'rgba(124,58,237,0.12)', color: '#7c3aed', icon: <Calendar size={13} />, label: 'Scheduled' },
  };

  const recipientStatusConfig: Record<string, { bg: string; color: string }> = {
    sent: { bg: 'rgba(37,99,235,0.12)', color: '#2563eb' },
    delivered: { bg: 'rgba(22,163,74,0.12)', color: '#16a34a' },
    read: { bg: 'rgba(6,182,212,0.12)', color: '#0891b2' },
    failed: { bg: 'rgba(239,68,68,0.12)', color: '#dc2626' },
    pending: { bg: 'rgba(100,116,139,0.12)', color: '#64748b' },
  };

  const bodyVars = (() => {
    const bodyComp = broadcastTplComponents?.find((c: any) => c.type === 'BODY');
    const vars = (bodyComp?.text?.match(/\{\{(\d+)\}\}/g) || []).map((m: string) => parseInt(m.match(/\d+/)![0], 10));
    return [...new Set(vars)].sort((a, b) => a - b);
  })();

  const totalRecipientsForCreate = recipientMode === 'csv' ? csvRecipients.length || (csvText.trim() ? parseCsv().length : 0) : broadcastRecipientCount;

  // Estimated send time
  const estimatedSeconds = totalRecipientsForCreate * (BATCH_DELAY_MS / 1000);
  const estimatedSendTime = estimatedSeconds < 60
    ? `~${Math.ceil(estimatedSeconds)} seconds`
    : estimatedSeconds < 3600
    ? `~${Math.ceil(estimatedSeconds / 60)} minutes`
    : `~${Math.ceil(estimatedSeconds / 3600)} hours`;

  // Sample preview variable values — use placeholder data to show what the message looks like
  const sampleVarValues: Record<string, string> = {};
  bodyVars.forEach((v) => {
    const field = variableMapping[String(v)];
    const samples: Record<string, string> = {
      full_name: 'Rahul Sharma', mobile_number: '9876543210', email: 'rahul@example.com',
      state: 'Maharashtra', trading_product: 'Forex', fund_amount: '50,000',
      lead_source: 'Facebook Ads', status: 'Interested',
    };
    sampleVarValues[String(v)] = field ? (samples[field] || `[${field}]`) : `{{${v}}}`;
  });

  const previewMessageText = buildPreviewText(broadcastTplComponents, sampleVarValues);

  // Count failed recipients in the selected campaign
  const failedRecipCount = broadcastRecipients.filter((r) => r.status === 'failed').length;

  return (
    <div className="wb-container">
      {/* Header */}
      <div className="wb-header">
        <div className="wb-header-left">
          <button className="wb-back-btn" onClick={onBack}><ArrowLeft size={18} /></button>
          <div>
            <h1 className="wb-title">WhatsApp Broadcast</h1>
            <p className="wb-subtitle">Send approved template messages to many leads at once</p>
          </div>
        </div>
        <div className="wb-header-actions">
          <button className="wb-refresh-btn" onClick={fetchBroadcasts} disabled={broadcastsLoading}>
            {broadcastsLoading ? <Loader2 size={16} className="crm-spin" /> : <RefreshCw size={16} />} Refresh
          </button>
          {!selectedBroadcast && !showBroadcastForm && (
            <>
              <button className="wb-refresh-btn" onClick={() => setShowAnalytics(true)} title="Analytics"><BarChart3 size={16} /> Analytics</button>
              <button className="wb-refresh-btn" onClick={() => setShowCalendar(true)} title="Calendar"><CalendarDays size={16} /> Calendar</button>
              <button className="wb-refresh-btn" onClick={() => setShowComparison(true)} title="Compare"><GitCompare size={16} /> Compare</button>
              <button className="wb-refresh-btn" onClick={() => setShowReplyTracking(true)} title="Replies"><MessageCircle size={16} /> Replies</button>
              <button className="wb-refresh-btn wb-cost-header-btn" onClick={() => setShowCostEstimator(true)} title="Estimate WhatsApp message cost"><DollarSign size={16} /> Message Cost</button>
              <button className="wb-refresh-btn" onClick={() => setShowAudienceManager(true)} title="Audiences"><UsersIcon size={16} /> Audiences</button>
              <button className="wb-refresh-btn" onClick={() => setShowDripBuilder(true)} title="Drip Sequences"><CalendarDaysIcon size={16} /> Drip</button>
              <button className="wb-refresh-btn" onClick={() => setShowOptOutManager(true)} title="Opt-outs"><Ban size={16} /> Opt-outs</button>
              <button className="wb-refresh-btn" onClick={() => setShowQuickRecreate(true)} title="Quick recreate"><Copy size={16} /> Presets</button>
              <button className="wb-new-btn" onClick={() => { setShowBroadcastForm(true); fetchBroadcastRecipientCount(broadcastRecipientFilter); }}>
                <Plus size={16} /> New Broadcast
              </button>
            </>
          )}
        </div>
      </div>

      {broadcastError && <div className="wb-error-banner"><AlertTriangle size={16} /> {broadcastError}</div>}

      {selectedBroadcast ? (
        <div className="wb-detail-view">
          <button className="wb-back-link" onClick={() => { setSelectedBroadcast(null); setBroadcastRecipients([]); }}>
            <ArrowLeft size={14} /> Back to campaigns
          </button>

          <div className="wb-detail-info">
            <div className="wb-detail-info-card">
              <span className="wb-detail-info-label">Campaign</span>
              <span className="wb-detail-info-value">{selectedBroadcast.campaign_name || selectedBroadcast.template_name}</span>
              <span className="wb-detail-info-sub">{selectedBroadcast.template_name} - {selectedBroadcast.template_language}</span>
            </div>
            <div className="wb-detail-info-card">
              <span className="wb-detail-info-label">Status</span>
              <span className="wb-status-pill" style={{ background: (statusConfig[selectedBroadcast.status] || statusConfig.draft).bg, color: (statusConfig[selectedBroadcast.status] || statusConfig.draft).color }}>
                {(statusConfig[selectedBroadcast.status] || statusConfig.draft).icon}
                {(statusConfig[selectedBroadcast.status] || statusConfig.draft).label}
              </span>
            </div>
            {selectedBroadcast.scheduled_at && (
              <div className="wb-detail-info-card">
                <span className="wb-detail-info-label">Scheduled</span>
                <span className="wb-detail-info-value">{new Date(selectedBroadcast.scheduled_at).toLocaleString()}</span>
              </div>
            )}
          </div>

          <div className="wb-detail-stats">
            {[
              { label: 'Total', value: selectedBroadcast.total_recipients, icon: <Users size={16} />, color: 'var(--text-muted)' },
              { label: 'Sent', value: selectedBroadcast.sent_count, icon: <Send size={16} />, color: '#2563eb' },
              { label: 'Delivered', value: selectedBroadcast.delivered_count, icon: <CheckCircle2 size={16} />, color: '#16a34a' },
              { label: 'Read', value: selectedBroadcast.read_count || 0, icon: <Eye size={16} />, color: '#0891b2' },
              { label: 'Failed', value: selectedBroadcast.failed_count, icon: <XCircle size={16} />, color: '#dc2626' },
            ].map((stat) => (
              <div key={stat.label} className="wb-detail-stat-tile">
                <div className="wb-detail-stat-icon" style={{ color: stat.color, background: `${stat.color}15` }}>{stat.icon}</div>
                <span className="wb-detail-stat-value" style={{ color: stat.color }}>{stat.value}</span>
                <span className="wb-detail-stat-label">{stat.label}</span>
              </div>
            ))}
          </div>

          {/* Retry failed banner */}
          {failedRecipCount > 0 && (selectedBroadcast.status === 'completed' || selectedBroadcast.status === 'failed') && (
            <div className="wb-retry-banner">
              <div className="wb-retry-info">
                <RotateCw size={16} />
                <span><strong>{failedRecipCount}</strong> recipient{failedRecipCount !== 1 ? 's' : ''} failed. You can retry sending to them.</span>
              </div>
              <button className="wb-retry-btn" onClick={() => handleRetryFailed(selectedBroadcast.id)} disabled={retryingId === selectedBroadcast.id}>
                {retryingId === selectedBroadcast.id ? <Loader2 size={14} className="crm-spin" /> : <RotateCw size={14} />}
                {retryingId === selectedBroadcast.id ? 'Retrying...' : 'Retry Failed'}
              </button>
            </div>
          )}

          <div className="wb-card wb-card-elevated">
            <div className="wb-card-header">
              <div className="wb-card-title">
                <div className="wb-card-icon wb-card-icon-green"><Eye size={18} /></div>
                <h2>Recipients</h2>
                <span className="wb-log-count">{broadcastRecipients.length}</span>
              </div>
            </div>
            {broadcastRecipientsLoading ? (
              <div className="wb-loading-state"><Loader2 size={28} className="crm-spin" style={{ color: '#25D366' }} /><p>Loading recipients...</p></div>
            ) : broadcastRecipients.length === 0 ? (
              <div className="wb-empty-state"><Users size={40} style={{ opacity: 0.25, marginBottom: 10 }} /><p>No recipients in this campaign.</p></div>
            ) : (
              <div className="wb-table-wrap">
                <table className="wb-table">
                  <thead><tr><th>Phone</th><th>Name</th><th>Status</th><th>Error</th></tr></thead>
                  <tbody>
                    {broadcastRecipients.map((r) => (
                      <tr key={r.id}>
                        <td className="wb-td-phone">+{r.phone_number}</td>
                        <td>{r.recipient_name || '—'}</td>
                        <td><span className="wb-status-pill wb-status-sm" style={{ background: (recipientStatusConfig[r.status] || recipientStatusConfig.pending).bg, color: (recipientStatusConfig[r.status] || recipientStatusConfig.pending).color }}>{r.status}</span></td>
                        <td className="wb-td-error">{r.error_message || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : showBroadcastForm ? (
        <div className="wb-form-layout">
          {/* Left: Form */}
          <div className="wb-card wb-card-elevated wb-form-card">
            <div className="wb-card-header">
              <div className="wb-card-title">
                <div className="wb-card-icon wb-card-icon-green"><Plus size={18} /></div>
                <h2>Create New Broadcast</h2>
              </div>
              <button className="wb-cancel-link" onClick={() => { setShowBroadcastForm(false); resetForm(); }}><ArrowLeft size={14} /> Cancel</button>
            </div>

            <div className="wb-form-body">
              <label className="wb-field">
                <span>Campaign Name (optional)</span>
                <input type="text" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="e.g. Diwali Offer 2026" className="wb-input" />
                <small className="wb-field-hint">A friendly name to identify this broadcast in your list.</small>
              </label>

              <label className="wb-field">
                <span>Select Template <em>*</em></span>
                <select value={broadcastTplName} onChange={(e) => handleSelectBroadcastTemplate(e.target.value)} className="wb-select">
                  <option value="">Choose an approved template...</option>
                  {approvedTemplates.map((t) => <option key={t.name} value={t.name}>{t.name} ({t.language})</option>)}
                </select>
                {approvedTemplates.length === 0 && (
                  <small className="wb-field-hint wb-field-hint-error">No approved templates yet. Go to WhatsApp Templates to create and get templates approved first.</small>
                )}
              </label>

              <label className="wb-field">
                <span>Send From (WhatsApp Number)</span>
                <select value={selectedPhoneId} onChange={(e) => setSelectedPhoneId(e.target.value)} className="wb-select">
                  <option value="">Default (first connected number)</option>
                  {phoneNumbers.map((p) => (
                    <option key={p.id} value={p.phone_number_id}>
                      {p.connected_phone_number || p.phone_number_display || p.phone_number_id}
                    </option>
                  ))}
                </select>
                <small className="wb-field-hint">Choose which connected WhatsApp number to send from.</small>
              </label>

              <div className="wb-field">
                <span>Recipient Source</span>
                <div className="wb-source-toggle">
                  <button type="button" className={recipientMode === 'lead_filter' ? 'active' : ''} onClick={() => setRecipientMode('lead_filter')}>
                    <Users size={14} /> Filter Leads
                  </button>
                  <button type="button" className={recipientMode === 'csv' ? 'active' : ''} onClick={() => setRecipientMode('csv')}>
                    <Upload size={14} /> Paste Phone Numbers
                  </button>
                  <button type="button" className="wb-source-toggle-segment" onClick={() => setShowSegmentBuilder(true)}>
                    <Filter size={14} /> Segment Builder
                  </button>
                </div>
              </div>

              {recipientMode === 'lead_filter' ? (
                <>
                  <label className="wb-field">
                    <span>Recipient Filter <em>*</em></span>
                    <div className="wb-filter-row">
                      <select value={broadcastRecipientFilter} onChange={(e) => setBroadcastRecipientFilter(e.target.value)} className="wb-select">
                        <option value="all">All Leads</option>
                        <option value="new">New Leads</option>
                        <option value="called_no_response">Called - No Response</option>
                        <option value="called_responded">Called - Responded</option>
                        <option value="interested">Interested</option>
                        <option value="not_interested">Not Interested</option>
                        <option value="converted">Converted</option>
                      </select>
                      <button type="button" className="wb-preview-btn" onClick={handlePreviewLeads}><Eye size={13} /> Preview</button>
                    </div>
                    <small className="wb-field-hint">{broadcastRecipientCount} leads match this filter. Only leads with a phone number will be included.</small>
                  </label>

                  {bodyVars.length > 0 && (
                    <div className="wb-var-map-section">
                      <div className="wb-var-map-header"><Zap size={14} /><span>Variable Mapping</span></div>
                      <small className="wb-field-hint">Map template variables to lead fields. Each recipient's message will auto-fill with their data.</small>
                      {bodyVars.map((v) => (
                        <div key={v} className="wb-var-map-row">
                          <span className="wb-var-map-label">{'{{' + v + '}}'}</span>
                          <ChevronRight size={14} style={{ color: '#94a3b8' }} />
                          <select value={variableMapping[String(v)] || ''} onChange={(e) => setVariableMapping((prev) => ({ ...prev, [String(v)]: e.target.value }))} className="wb-select wb-var-map-select">
                            <option value="">-- Select field --</option>
                            {LEAD_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <label className="wb-field">
                  <span>Phone Numbers <em>*</em></span>
                  <textarea value={csvText} onChange={(e) => { setCsvText(e.target.value); parseCsv(); }} rows={6} placeholder={'+919876543210, John Doe\n+12345678900, Jane Smith\n+441234567890'} className="wb-textarea" />
                  <small className="wb-field-hint">One per line. Format: phone_number, optional_name. {csvRecipients.length} valid numbers detected.</small>
                </label>
              )}

              {/* Duplicate prevention warning */}
              {duplicateInfo && duplicateInfo.duplicates > 0 && (
                <div className="wb-duplicate-warning">
                  <AlertTriangle size={14} />
                  <span><strong>{duplicateInfo.duplicates}</strong> of {duplicateInfo.total} recipients already received this template in the last 24 hours. Sending again may affect your WhatsApp quality rating.</span>
                </div>
              )}
              {duplicateInfo && duplicateInfo.duplicates === 0 && duplicateInfo.total > 0 && (
                <div className="wb-duplicate-ok">
                  <CheckCircle2 size={14} />
                  <span>No duplicates found — none of these contacts received this template in the last 24 hours.</span>
                </div>
              )}
              {duplicateChecking && (
                <div className="wb-duplicate-checking"><Loader2 size={12} className="crm-spin" /> Checking for recent sends...</div>
              )}

              <label className="wb-field">
                <span>Schedule (optional)</span>
                <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="wb-input" />
                <small className="wb-field-hint">Leave empty to send manually. If scheduled, the campaign auto-sends at the set time — no manual click needed.</small>
              </label>

              {/* Estimated send time */}
              {totalRecipientsForCreate > 0 && (
                <div className="wb-estimate-box">
                  <Timer size={14} />
                  <span>Estimated send time for {totalRecipientsForCreate} recipients: <strong>{estimatedSendTime}</strong></span>
                </div>
              )}

              {/* Throttle control */}
              <ThrottleControl currentDelay={throttleDelay} onChange={setThrottleDelay} />

              {/* Feature quick buttons */}
              <div className="wb-feature-quick-btns">
                <button type="button" className="wb-quick-btn" onClick={() => setShowSendTime(true)}><Clock3 size={13} /> Optimize Send Time</button>
                <button type="button" className="wb-quick-btn" onClick={() => setShowCostEstimator(true)} disabled={totalRecipientsForCreate === 0}><DollarSign size={13} /> Message Cost Calculator</button>
                <button type="button" className="wb-quick-btn" onClick={() => setShowABTest(true)}><FlaskConical size={13} /> A/B Test</button>
              </div>

              {segmentConditions.length > 0 && (
                <div className="wb-segment-applied">
                  <Filter size={14} />
                  <span>Custom segment applied: {segmentConditions.length} condition{segmentConditions.length !== 1 ? 's' : ''}</span>
                  <button type="button" onClick={() => setSegmentConditions([])}>Clear</button>
                </div>
              )}

              <div className="wb-warn-box">
                <AlertTriangle size={16} />
                <div>
                  <strong>Before you send:</strong> Make sure your WhatsApp Business number is verified and your account has enough daily messaging quota. New accounts start at 250-1,000 unique contacts per day. Messages are sent one by one with a small delay.
                </div>
              </div>

              <button type="button" onClick={handleCreateBroadcast} disabled={!broadcastTplName || (recipientMode === 'lead_filter' && broadcastRecipientCount === 0) || (recipientMode === 'csv' && csvRecipients.length === 0) || broadcastCreating} className="wb-create-btn">
                {broadcastCreating ? <Loader2 size={18} className="crm-spin" /> : scheduledAt ? <Calendar size={16} /> : <Send size={16} />}
                {broadcastCreating ? 'Creating...' : scheduledAt ? `Schedule Broadcast (${totalRecipientsForCreate} recipients)` : `Create Broadcast (${totalRecipientsForCreate} recipients)`}
              </button>
            </div>
          </div>

          {/* Right: WhatsApp chat preview */}
          <div className="wb-preview-panel">
            <div className="wb-preview-panel-header">
              <MessageSquare size={16} /><span>Message Preview</span>
            </div>
            <div className="wb-chat-preview">
              {!broadcastTplName ? (
                <div className="wb-chat-empty">
                  <MessageSquare size={32} style={{ opacity: 0.2, marginBottom: 8 }} />
                  <p>Select a template to see how your message will look</p>
                </div>
              ) : (
                <div className="wb-chat-bubble">
                  <p className="wb-chat-text">{previewMessageText}</p>
                  <div className="wb-chat-meta">
                    <span className="wb-chat-time">12:30 PM</span>
                    <CheckCheck size={14} className="wb-chat-ticks" />
                  </div>
                </div>
              )}
            </div>
            {broadcastTplName && (
              <div className="wb-preview-footer">
                <small>Preview uses sample data. Each recipient sees their own mapped values.</small>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="wb-stats-grid">
            {[
              { icon: <Send size={22} />, value: broadcasts.length, label: 'Total Campaigns', color: 'green' },
              { icon: <Users size={22} />, value: aggregateStats.total, label: 'Total Recipients', color: 'blue' },
              { icon: <CheckCircle2 size={22} />, value: aggregateStats.delivered, label: 'Delivered', color: 'cyan' },
              { icon: <Eye size={22} />, value: aggregateStats.read, label: 'Read', color: 'cyan' },
              { icon: <XCircle size={22} />, value: aggregateStats.failed, label: 'Failed', color: 'red' },
            ].map((card, i) => (
              <div key={i} className={`wb-stat-card wb-stat-${card.color}`}>
                <div className="wb-stat-glow" />
                <div className="wb-stat-top"><div className="wb-stat-icon-wrap">{card.icon}</div></div>
                <span className="wb-stat-value">{card.value}</span>
                <span className="wb-stat-label">{card.label}</span>
              </div>
            ))}
          </div>

          <div className="wb-card wb-card-elevated">
            <div className="wb-card-header">
              <div className="wb-card-title">
                <div className="wb-card-icon wb-card-icon-green"><Send size={18} /></div>
                <h2>Campaigns</h2>
                <span className="wb-log-count">{broadcasts.length}</span>
              </div>
            </div>

            {broadcastsLoading ? (
              <div className="wb-loading-state"><Loader2 size={28} className="crm-spin" style={{ color: '#25D366' }} /><p>Loading campaigns...</p></div>
            ) : broadcasts.length === 0 ? (
              <div className="wb-empty-state">
                <Send size={40} style={{ opacity: 0.25, marginBottom: 10 }} />
                <h3>No broadcast campaigns yet</h3>
                <p>Click "New Broadcast" to send a WhatsApp template to many leads at once.</p>
              </div>
            ) : (
              <div className="wb-campaign-list">
                {broadcasts.map((camp) => {
                  const progress = camp.total_recipients > 0 ? Math.round(((camp.sent_count + camp.failed_count) / camp.total_recipients) * 100) : 0;
                  const sc = statusConfig[camp.status] || statusConfig.draft;
                  const deliveryRate = camp.sent_count > 0 ? Math.round((camp.delivered_count / camp.sent_count) * 100) : 0;
                  const readRate = camp.delivered_count > 0 ? Math.round(((camp.read_count || 0) / camp.delivered_count) * 100) : 0;
                  return (
                    <div key={camp.id} className="wb-campaign-item">
                      <div className="wb-campaign-top">
                        <div className="wb-campaign-info">
                          <span className="wb-campaign-name">{camp.campaign_name || camp.template_name}</span>
                          <span className="wb-campaign-template">{camp.template_name} - {camp.template_language}</span>
                          <span className="wb-campaign-date"><Clock size={11} /> {new Date(camp.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                          {camp.scheduled_at && <span className="wb-campaign-scheduled"><Calendar size={11} /> Scheduled: {new Date(camp.scheduled_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>}
                        </div>
                        <span className="wb-status-pill" style={{ background: sc.bg, color: sc.color }}>{sc.icon}{sc.label}</span>
                      </div>

                      <div className="wb-campaign-stats">
                        <span><strong>{camp.total_recipients}</strong> recipients</span>
                        <span className="wb-campaign-stat-blue"><strong>{camp.sent_count}</strong> sent</span>
                        <span className="wb-campaign-stat-green"><strong>{camp.delivered_count}</strong> delivered</span>
                        {(camp.read_count || 0) > 0 && <span className="wb-campaign-stat-cyan"><strong>{camp.read_count}</strong> read</span>}
                        <span className="wb-campaign-stat-red"><strong>{camp.failed_count}</strong> failed</span>
                        {camp.sent_count > 0 && <span className="wb-campaign-rate">{deliveryRate}% delivery</span>}
                        {camp.delivered_count > 0 && (camp.read_count || 0) > 0 && <span className="wb-campaign-rate">{readRate}% read</span>}
                      </div>

                      {(camp.status === 'sending' || camp.status === 'completed') && (
                        <div className="wb-progress-track">
                          <div className="wb-progress-fill" style={{ width: `${progress}%`, background: camp.status === 'completed' ? '#16a34a' : '#2563eb' }} />
                        </div>
                      )}

                      <div className="wb-campaign-actions">
                        <button className="wb-action-btn wb-action-btn-ghost" onClick={() => fetchBroadcastRecipients(camp.id)}><Eye size={13} /> Details</button>
                        {camp.status === 'draft' && (
                          <button className="wb-action-btn wb-action-btn-primary" onClick={() => handleSendBroadcast(camp.id)} disabled={broadcastSending && broadcastSendingId === camp.id}>
                            {broadcastSending && broadcastSendingId === camp.id ? <Loader2 size={13} className="crm-spin" /> : <Send size={13} />}
                            {broadcastSending && broadcastSendingId === camp.id ? 'Sending...' : 'Send Now'}
                          </button>
                        )}
                        {(camp.status === 'completed' || camp.status === 'failed') && camp.failed_count > 0 && (
                          <button className="wb-action-btn wb-action-btn-warn" onClick={() => handleRetryFailed(camp.id)} disabled={retryingId === camp.id}>
                            {retryingId === camp.id ? <Loader2 size={13} className="crm-spin" /> : <RotateCw size={13} />}
                            {retryingId === camp.id ? 'Retrying...' : `Retry (${camp.failed_count})`}
                          </button>
                        )}
                        {camp.status === 'scheduled' && (
                          <button className="wb-action-btn wb-action-btn-ghost" onClick={() => handleCancelBroadcast(camp.id)} disabled={cancelingId === camp.id}>
                            {cancelingId === camp.id ? <Loader2 size={13} className="crm-spin" /> : <X size={13} />} Cancel
                          </button>
                        )}
                        <button className="wb-action-btn wb-action-btn-danger" onClick={() => handleDeleteBroadcast(camp.id)}><Trash2 size={13} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="wb-info-section">
            <div className="wb-info-card">
              <div className="wb-info-icon"><Info size={18} /></div>
              <div>
                <h4>How WhatsApp Broadcast Works</h4>
                <ul>
                  <li><strong>Pick a template:</strong> Only Meta-approved templates can be sent. Create and get templates approved in the Templates page first.</li>
                  <li><strong>Choose recipients:</strong> Filter your existing leads by status, or paste a list of phone numbers manually.</li>
                  <li><strong>Map variables:</strong> If your template has placeholders like {'{{1}}'}, they auto-fill from each lead's name, email, etc.</li>
                  <li><strong>Preview before sending:</strong> See a WhatsApp-style chat bubble showing exactly what each recipient will receive.</li>
                  <li><strong>Schedule or send now:</strong> Create as draft and send immediately, or schedule for auto-send at a future date.</li>
                  <li><strong>Retry failures:</strong> Re-send to any recipients that failed without creating a new campaign.</li>
                  <li><strong>Track results:</strong> See sent, delivered, read, and failed counts for each campaign in real-time.</li>
                </ul>
              </div>
            </div>
            <div className="wb-info-card wb-info-card-warn">
              <div className="wb-info-icon wb-info-icon-warn"><AlertTriangle size={18} /></div>
              <div>
                <h4>Important Limitations</h4>
                <ul>
                  <li>WhatsApp only allows broadcast messages using <strong>approved templates</strong> - no free text.</li>
                  <li>New WhatsApp Business accounts start with <strong>250-1,000 unique contacts/day</strong>. This limit increases over time.</li>
                  <li>Messages are sent <strong>one by one</strong> with a delay to avoid rate limiting.</li>
                  <li><strong>Duplicate prevention:</strong> You'll see a warning if any recipients already received the same template in the last 24 hours.</li>
                  <li>Repeatedly sending to users who don't respond can lower your <strong>quality rating</strong> and reduce daily limits.</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}

      {showPreview && (
        <div className="wb-modal-overlay" onClick={() => setShowPreview(false)}>
          <div className="wb-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="wb-modal-header">
              <div className="wb-modal-title"><Eye size={16} /><span>Recipient Preview (first 50)</span></div>
              <button onClick={() => setShowPreview(false)} className="wb-modal-close"><X size={16} /></button>
            </div>
            <div className="wb-modal-body">
              {previewLeads.length === 0 ? (
                <p className="wb-modal-empty">No leads match this filter.</p>
              ) : (
                <table className="wb-table">
                  <thead><tr><th>Name</th><th>Phone</th><th>Status</th></tr></thead>
                  <tbody>
                    {previewLeads.map((l: any) => (
                      <tr key={l.id}>
                        <td>{l.full_name || '—'}</td>
                        <td className="wb-td-phone">{l.mobile_number || '—'}</td>
                        <td>{l.status || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {showAnalytics && <BroadcastAnalyticsDashboard broadcasts={broadcasts} onClose={() => setShowAnalytics(false)} />}
      {showSegmentBuilder && <SegmentationBuilder session={session} onApply={handleSegmentApply} onClose={() => setShowSegmentBuilder(false)} />}
      {showQuickRecreate && <QuickRecreatePanel session={session} broadcasts={broadcasts} onRecreate={handleRecreatePreset} onClose={() => setShowQuickRecreate(false)} />}
      {showABTest && <ABTestBroadcastModal templates={approvedTemplates.map((t) => ({ name: t.name, language: t.language }))} onLaunch={handleABTestLaunch} onClose={() => setShowABTest(false)} />}
      {showSendTime && <SendTimeOptimization broadcasts={broadcasts} onApply={handleSendTimeApply} onClose={() => setShowSendTime(false)} />}
      {showReplyTracking && <ReplyTrackingPanel broadcasts={broadcasts} onClose={() => setShowReplyTracking(false)} />}
      {showCostEstimator && <CostEstimator recipientCount={totalRecipientsForCreate} broadcasts={broadcasts} onClose={() => setShowCostEstimator(false)} />}
      {showComparison && <CampaignComparison broadcasts={broadcasts} onClose={() => setShowComparison(false)} />}
      {showCalendar && <BroadcastCalendarView broadcasts={broadcasts} onSelect={(camp) => { setShowCalendar(false); fetchBroadcastRecipients(camp.id); }} onClose={() => setShowCalendar(false)} />}
      {showAudienceManager && <AudienceManagerPanel session={session} onUseAudience={(conditions, count, name) => { setShowAudienceManager(false); handleSegmentApply(conditions, count); }} onClose={() => setShowAudienceManager(false)} />}
      {showOptOutManager && <OptOutManagerPanel session={session} onClose={() => setShowOptOutManager(false)} />}
      {showDripBuilder && <DripSequenceBuilder session={session} templates={waTemplates} onClose={() => setShowDripBuilder(false)} />}
    </div>
  );
}
