import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import {
  ArrowLeft, Plus, Zap, Play, Pause, Trash2, Copy, GripVertical,
  MessageCircle, Mail, Tag, Shuffle, Clock, GitBranch, Webhook,
  BellRing, UserPlus, CalendarClock, Settings as SettingsIcon,
  Check, X, ChevronDown, ChevronRight, Loader2, Save,
  Phone, TrendingUp, Bot, Eye, AlertTriangle, RefreshCw,
  MoreVertical, Grip, ArrowDown, Send, Search, Sparkles, Activity,
  FlaskConical, Lightbulb, Calendar, ExternalLink, Target,
} from 'lucide-react';

type TriggerType = 'lead_created' | 'whatsapp_received' | 'telegram_received' | 'lead_status_changed' | 'lead_tagged' | 'lead_assigned' | 'email_opened' | 'call_completed' | 'webhook_received';
type ActionType = 'send_email' | 'send_whatsapp' | 'send_telegram' | 'assign_lead' | 'add_tag' | 'change_status' | 'send_notification' | 'fire_webhook' | 'schedule_followup' | 'delay' | 'condition';

type FlowAction = {
  id: string;
  type: ActionType;
  config: Record<string, unknown>;
};

type AutomationFlow = {
  id: string;
  name: string;
  description: string;
  trigger_type: TriggerType;
  trigger_config: Record<string, unknown>;
  actions: FlowAction[];
  is_active: boolean;
  user_id: string;
  created_at: string;
  updated_at: string;
  webhook_url?: string | null;
  time_window_config?: Record<string, unknown>;
};

type AutomationRun = {
  id: string;
  flow_id: string;
  lead_id: string | null;
  status: string;
  run_log: Record<string, unknown>;
  created_at: string;
  is_test?: boolean;
  result_summary?: string | null;
};

type Suggestion = {
  id: string;
  suggestion_type: string;
  title: string;
  description: string;
  data: Record<string, unknown>;
  confidence: number;
  status: string;
};

const TRIGGER_OPTIONS: { type: TriggerType; label: string; icon: typeof Zap; color: string; desc: string }[] = [
  { type: 'lead_created', label: 'New Lead Created', icon: UserPlus, color: '#3B82F6', desc: 'When a new lead is added via form or bulk upload' },
  { type: 'whatsapp_received', label: 'WhatsApp Message Received', icon: MessageCircle, color: '#22C55E', desc: 'When a lead sends a WhatsApp message' },
  { type: 'telegram_received', label: 'Telegram Message Received', icon: Send, color: '#0088CC', desc: 'When a lead sends a Telegram message' },
  { type: 'lead_status_changed', label: 'Lead Status Changed', icon: RefreshCw, color: '#F59E0B', desc: 'When a lead moves to a different pipeline stage' },
  { type: 'lead_tagged', label: 'Lead Tagged', icon: Tag, color: '#8B5CF6', desc: 'When a tag is added to a lead' },
  { type: 'lead_assigned', label: 'Lead Assigned', icon: Shuffle, color: '#EC4899', desc: 'When a lead is assigned to a team member' },
  { type: 'email_opened', label: 'Email Opened', icon: Mail, color: '#6366F1', desc: 'When a lead opens an email you sent' },
  { type: 'call_completed', label: 'Call Completed', icon: Phone, color: '#06B6D4', desc: 'When a WhatsApp call ends' },
  { type: 'webhook_received', label: 'External Webhook', icon: Webhook, color: '#EF4444', desc: 'Trigger from any external system via webhook URL' },
];

const ACTION_PALETTE: { type: ActionType; label: string; icon: typeof Zap; color: string; desc: string; group: string }[] = [
  { type: 'send_email', label: 'Send Email', icon: Mail, color: '#6366F1', desc: 'Send an email to the lead', group: 'Messages' },
  { type: 'send_whatsapp', label: 'Send WhatsApp', icon: MessageCircle, color: '#22C55E', desc: 'Send a WhatsApp message', group: 'Messages' },
  { type: 'send_telegram', label: 'Send Telegram', icon: Send, color: '#0088CC', desc: 'Send a Telegram message', group: 'Messages' },
  { type: 'send_notification', label: 'Team Notification', icon: BellRing, color: '#F59E0B', desc: 'Post a message in team chat', group: 'Messages' },
  { type: 'assign_lead', label: 'Assign Lead', icon: Shuffle, color: '#EC4899', desc: 'Assign lead to a team member', group: 'Lead' },
  { type: 'add_tag', label: 'Add Tag', icon: Tag, color: '#8B5CF6', desc: 'Add a tag to the lead', group: 'Lead' },
  { type: 'change_status', label: 'Change Status', icon: RefreshCw, color: '#F59E0B', desc: 'Move lead to a pipeline stage', group: 'Lead' },
  { type: 'schedule_followup', label: 'Schedule Follow-Up', icon: CalendarClock, color: '#06B6D4', desc: 'Create a follow-up reminder', group: 'Lead' },
  { type: 'delay', label: 'Wait / Delay', icon: Clock, color: '#64748B', desc: 'Pause before next action', group: 'Control' },
  { type: 'condition', label: 'Condition (If/Else)', icon: GitBranch, color: '#0EA5E9', desc: 'Branch based on lead data, with optional ELSE path', group: 'Control' },
  { type: 'fire_webhook', label: 'Fire Webhook', icon: Webhook, color: '#EF4444', desc: 'Send data to an external URL', group: 'Integrations' },
];

const PIPELINE_STAGES = [
  { key: 'new', label: 'New' },
  { key: 'called_no_response', label: 'Called - No Response' },
  { key: 'called_responded', label: 'Called - Responded' },
  { key: 'interested', label: 'Interested' },
  { key: 'not_interested', label: 'Not Interested' },
  { key: 'converted', label: 'Converted' },
];

const PRODUCTS = [
  { key: 'algo', label: 'Trading Algo' },
  { key: 'tradingview_premium', label: 'TradingView Premium' },
];

const CONDITION_OPERATORS = [
  { key: 'equals', label: 'equals' },
  { key: 'not_equals', label: 'does not equal' },
  { key: 'contains', label: 'contains' },
  { key: 'greater_than', label: 'greater than' },
  { key: 'less_than', label: 'less than' },
];

const CONDITION_FIELDS = [
  { key: 'status', label: 'Status' },
  { key: 'trading_product', label: 'Product' },
  { key: 'fund_amount', label: 'Fund Amount' },
  { key: 'state', label: 'State' },
  { key: 'email', label: 'Email' },
  { key: 'mobile_number', label: 'Mobile Number' },
];

const DAYS_OF_WEEK = [
  { key: 0, label: 'Sun' },
  { key: 1, label: 'Mon' },
  { key: 2, label: 'Tue' },
  { key: 3, label: 'Wed' },
  { key: 4, label: 'Thu' },
  { key: 5, label: 'Fri' },
  { key: 6, label: 'Sat' },
];

function genId() {
  return `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

type AutomationTemplate = {
  name: string;
  description: string;
  category: string;
  trigger_type: TriggerType;
  trigger_config: Record<string, unknown>;
  actions: { type: ActionType; config: Record<string, unknown> }[];
};

const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    name: 'Instant WhatsApp Reply',
    description: 'Automatically send a welcome WhatsApp message when a new lead comes in.',
    category: 'Welcome',
    trigger_type: 'lead_created',
    trigger_config: {},
    actions: [
      { type: 'send_whatsapp', config: { message: 'Hi {{lead_name}}, thanks for reaching out! Our team will get back to you shortly.' } },
    ],
  },
  {
    name: 'Welcome Email Sequence',
    description: 'Send a welcome email immediately, then a follow-up email after 2 days.',
    category: 'Welcome',
    trigger_type: 'lead_created',
    trigger_config: {},
    actions: [
      { type: 'send_email', config: { subject: 'Welcome aboard, {{lead_name}}!', body: 'Thanks for signing up. Here\'s everything you need to know to get started.' } },
      { type: 'delay', config: { minutes: '0', hours: '0', days: '2' } },
      { type: 'send_email', config: { subject: 'Any questions so far?', body: 'Hi {{lead_name}}, just checking in. Do you have any questions we can help with?' } },
    ],
  },
  {
    name: 'Auto-Assign Round Robin',
    description: 'Notify the team in team chat whenever a new lead is created so they can claim it.',
    category: 'Routing',
    trigger_type: 'lead_created',
    trigger_config: {},
    actions: [
      { type: 'send_notification', config: { message: 'New lead assigned: {{lead_name}} ({{lead_email}}). Please follow up!' } },
    ],
  },
  {
    name: 'Re-Engage Cold Leads',
    description: 'When a lead is marked as Called - No Response, schedule a follow-up reminder for 3 days later.',
    category: 'Follow-up',
    trigger_type: 'lead_status_changed',
    trigger_config: { status: 'called_no_response' },
    actions: [
      { type: 'schedule_followup', config: { title: 'Re-engage cold lead', days: '3', note: 'Lead was called but did not respond. Try a different channel.' } },
    ],
  },
  {
    name: 'Hot Lead Alert',
    description: 'When a lead is tagged "hot", notify the team and change status to Interested.',
    category: 'Routing',
    trigger_type: 'lead_tagged',
    trigger_config: { tag: 'hot' },
    actions: [
      { type: 'send_notification', config: { message: 'Hot lead detected: {{lead_name}}! Follow up immediately.' } },
      { type: 'change_status', config: { status: 'interested' } },
    ],
  },
  {
    name: 'Email Open Follow-Up',
    description: 'When a lead opens an email, wait 1 day then send a WhatsApp message to follow up.',
    category: 'Follow-up',
    trigger_type: 'email_opened',
    trigger_config: {},
    actions: [
      { type: 'delay', config: { minutes: '0', hours: '0', days: '1' } },
      { type: 'send_whatsapp', config: { message: 'Hi {{lead_name}}, saw you checked our email. Any questions I can answer?' } },
    ],
  },
  {
    name: 'Conversion Celebration',
    description: 'When a lead converts, notify the team and tag them as "won".',
    category: 'Sales',
    trigger_type: 'lead_status_changed',
    trigger_config: { status: 'converted' },
    actions: [
      { type: 'send_notification', config: { message: 'Conversion! {{lead_name}} just became a customer!' } },
      { type: 'add_tag', config: { tag: 'won' } },
    ],
  },
  {
    name: 'Post-Call Follow-Up',
    description: 'After a WhatsApp call completes, schedule a follow-up for the next day and send a summary email.',
    category: 'Follow-up',
    trigger_type: 'call_completed',
    trigger_config: {},
    actions: [
      { type: 'send_email', config: { subject: 'Thanks for the call, {{lead_name}}', body: 'Great speaking with you. Here\'s a summary of what we discussed.' } },
      { type: 'schedule_followup', config: { title: 'Post-call follow-up', days: '1', note: 'Follow up after the initial call.' } },
    ],
  },
];

export default function AutomationBuilder({ session, onBack }: { session: Session; onBack: () => void }) {
  const [flows, setFlows] = useState<AutomationFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingFlow, setEditingFlow] = useState<AutomationFlow | null>(null);
  const [view, setView] = useState<'list' | 'editor' | 'runs' | 'suggestions'>('list');
  const [selectedFlowForRuns, setSelectedFlowForRuns] = useState<AutomationFlow | null>(null);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTrigger, setFilterTrigger] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'paused'>('all');
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateCategory, setTemplateCategory] = useState<string>('All');
  const [flowStats, setFlowStats] = useState<Record<string, { total: number; success: number; failed: number; lastRun: string | null; conversions: number }>>({});
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const fetchFlowStats = useCallback(async (flowIds: string[]) => {
    if (flowIds.length === 0) return;
    try {
      const { data } = await supabase
        .from('automation_runs')
        .select('flow_id, status, created_at, lead_id, is_test')
        .in('flow_id', flowIds)
        .order('created_at', { ascending: false });
      if (!data) return;
      const stats: Record<string, { total: number; success: number; failed: number; lastRun: string | null; conversions: number }> = {};
      const leadIdsByFlow: Record<string, Set<string>> = {};
      for (const row of data as { flow_id: string; status: string; created_at: string; lead_id: string | null; is_test: boolean }[]) {
        if (row.is_test) continue;
        const existing = stats[row.flow_id] || { total: 0, success: 0, failed: 0, lastRun: null, conversions: 0 };
        existing.total++;
        if (row.status === 'success') existing.success++;
        if (row.status === 'failed') existing.failed++;
        if (!existing.lastRun) existing.lastRun = row.created_at;
        if (row.lead_id) {
          if (!leadIdsByFlow[row.flow_id]) leadIdsByFlow[row.flow_id] = new Set();
          leadIdsByFlow[row.flow_id].add(row.lead_id);
        }
        stats[row.flow_id] = existing;
      }
      const allLeadIds = new Set<string>();
      for (const ids of Object.values(leadIdsByFlow)) {
        for (const id of ids) allLeadIds.add(id);
      }
      if (allLeadIds.size > 0) {
        const { data: convertedLeads } = await supabase
          .from('submissions')
          .select('id')
          .in('id', Array.from(allLeadIds))
          .eq('status', 'converted');
        const convertedSet = new Set((convertedLeads || []).map((l: { id: string }) => l.id));
        for (const [fid, ids] of Object.entries(leadIdsByFlow)) {
          let count = 0;
          for (const id of ids) { if (convertedSet.has(id)) count++; }
          if (stats[fid]) stats[fid].conversions = count;
        }
      }
      setFlowStats(stats);
    } catch {
      // stats are non-critical
    }
  }, []);

  const fetchFlows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, err } = await supabase
        .from('automation_flows')
        .select('*')
        .order('created_at', { ascending: false });
      if (err) throw err;
      setFlows((data as AutomationFlow[]) || []);
      if (data && data.length > 0) {
        fetchFlowStats(data.map((f) => f.id));
      }
    } catch {
      setError('Failed to load automations. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [fetchFlowStats]);

  useEffect(() => {
    fetchFlows();
  }, [fetchFlows]);

  const handleToggleActive = async (flow: AutomationFlow) => {
    const newVal = !flow.is_active;
    setFlows((prev) => prev.map((f) => (f.id === flow.id ? { ...f, is_active: newVal } : f)));
    try {
      await supabase.from('automation_flows').update({ is_active: newVal }).eq('id', flow.id);
    } catch {
      setFlows((prev) => prev.map((f) => (f.id === flow.id ? { ...f, is_active: !newVal } : f)));
    }
  };

  const handleDelete = async (flow: AutomationFlow) => {
    if (!confirm(`Delete "${flow.name}"? This cannot be undone.`)) return;
    setFlows((prev) => prev.filter((f) => f.id !== flow.id));
    try {
      await supabase.from('automation_flows').delete().eq('id', flow.id);
    } catch {
      fetchFlows();
    }
  };

  const handleDuplicate = async (flow: AutomationFlow) => {
    try {
      const { data } = await supabase
        .from('automation_flows')
        .insert({
          name: `${flow.name} (Copy)`,
          description: flow.description,
          trigger_type: flow.trigger_type,
          trigger_config: flow.trigger_config,
          actions: flow.actions,
          is_active: false,
          user_id: session.user.id,
        })
        .select()
        .single();
      if (data) setFlows((prev) => [data as AutomationFlow, ...prev]);
    } catch {
      setError('Failed to duplicate automation.');
    }
  };

  const handleSave = async (flow: AutomationFlow) => {
    try {
      const { data } = await supabase
        .from('automation_flows')
        .update({
          name: flow.name,
          description: flow.description,
          trigger_type: flow.trigger_type,
          trigger_config: flow.trigger_config,
          actions: flow.actions,
          webhook_url: flow.webhook_url || null,
          time_window_config: flow.time_window_config || {},
          updated_at: new Date().toISOString(),
        })
        .eq('id', flow.id)
        .select()
        .single();
      if (data) {
        setFlows((prev) => prev.map((f) => (f.id === flow.id ? data as AutomationFlow : f)));
        setEditingFlow(data as AutomationFlow);
      }
    } catch {
      setError('Failed to save automation.');
    }
  };

  const handleCreate = () => {
    const newFlow: AutomationFlow = {
      id: `temp_${Date.now()}`,
      name: 'Untitled Automation',
      description: '',
      trigger_type: 'lead_created',
      trigger_config: {},
      actions: [],
      is_active: false,
      user_id: session.user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setEditingFlow(newFlow);
    setView('editor');
  };

  const handleUseTemplate = (tpl: AutomationTemplate) => {
    const newFlow: AutomationFlow = {
      id: `temp_${Date.now()}`,
      name: tpl.name,
      description: tpl.description,
      trigger_type: tpl.trigger_type,
      trigger_config: { ...tpl.trigger_config },
      actions: tpl.actions.map((a) => ({ id: genId(), type: a.type, config: { ...a.config } })),
      is_active: false,
      user_id: session.user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setShowTemplates(false);
    setEditingFlow(newFlow);
    setView('editor');
  };

  const filteredFlows = useMemo(() => {
    return flows.filter((f) => {
      const matchesSearch = !searchQuery || f.name.toLowerCase().includes(searchQuery.toLowerCase()) || (f.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTrigger = filterTrigger === 'all' || f.trigger_type === filterTrigger;
      const matchesStatus = filterStatus === 'all' || (filterStatus === 'active' && f.is_active) || (filterStatus === 'paused' && !f.is_active);
      return matchesSearch && matchesTrigger && matchesStatus;
    });
  }, [flows, searchQuery, filterTrigger, filterStatus]);

  const templateCategories = useMemo(() => ['All', ...Array.from(new Set(AUTOMATION_TEMPLATES.map((t) => t.category)))], []);
  const filteredTemplates = useMemo(() => {
    return templateCategory === 'All' ? AUTOMATION_TEMPLATES : AUTOMATION_TEMPLATES.filter((t) => t.category === templateCategory);
  }, [templateCategory]);

  const handleEdit = (flow: AutomationFlow) => {
    setEditingFlow(flow);
    setView('editor');
  };

  const handleViewRuns = async (flow: AutomationFlow) => {
    setSelectedFlowForRuns(flow);
    setView('runs');
    setRunsLoading(true);
    try {
      const { data } = await supabase
        .from('automation_runs')
        .select('*')
        .eq('flow_id', flow.id)
        .order('created_at', { ascending: false })
        .limit(50);
      setRuns((data as AutomationRun[]) || []);
    } catch {
      setRuns([]);
    } finally {
      setRunsLoading(false);
    }
  };

  const fetchSuggestions = useCallback(async () => {
    setSuggestionsLoading(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-automations`;
      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode: 'generate_suggestions', user_id: session.user.id }),
      });
      if (resp.ok) {
        const result = await resp.json();
        setSuggestions(result.suggestions || []);
      }
    } catch {
      // non-critical
    } finally {
      setSuggestionsLoading(false);
    }
  }, [session.user.id]);

  const dismissSuggestion = async (id: string) => {
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
    await supabase.from('automation_suggestions').update({ status: 'dismissed' }).eq('id', id);
  };

  if (view === 'editor' && editingFlow) {
    return (
      <FlowEditor
        flow={editingFlow}
        isNew={editingFlow.id.startsWith('temp_')}
        session={session}
        onBack={() => { setView('list'); setEditingFlow(null); fetchFlows(); }}
        onSave={async (updated) => {
          if (updated.id.startsWith('temp_')) {
            try {
              const { data } = await supabase
                .from('automation_flows')
                .insert({
                  name: updated.name,
                  description: updated.description,
                  trigger_type: updated.trigger_type,
                  trigger_config: updated.trigger_config,
                  actions: updated.actions,
                  is_active: updated.is_active,
                  user_id: session.user.id,
                  webhook_url: updated.webhook_url || null,
                  time_window_config: updated.time_window_config || {},
                })
                .select()
                .single();
              if (data) {
                setFlows((prev) => [data as AutomationFlow, ...prev]);
                setEditingFlow(data as AutomationFlow);
              }
            } catch {
              setError('Failed to create automation.');
            }
          } else {
            await handleSave(updated);
          }
        }}
      />
    );
  }

  if (view === 'runs' && selectedFlowForRuns) {
    return (
      <RunsView flow={selectedFlowForRuns} runs={runs} loading={runsLoading} onBack={() => { setView('list'); setSelectedFlowForRuns(null); }} />
    );
  }

  if (view === 'suggestions') {
    return (
      <SuggestionsView
        suggestions={suggestions}
        loading={suggestionsLoading}
        onBack={() => setView('list')}
        onRefresh={fetchSuggestions}
        onDismiss={dismissSuggestion}
        onCreateAutomation={() => { setView('list'); handleCreate(); }}
      />
    );
  }

  return (
    <div className="automation-builder">
      <div className="dash-page-header">
        <button className="dash-back-btn" onClick={onBack}><ArrowLeft size={18} /> Back</button>
        <h1>Automation Builder</h1>
        <p>Build drag-and-drop workflows that automate WhatsApp, Telegram, email, and lead management</p>
      </div>

      <div className="automation-list-header">
        <div className="automation-list-stats">
          <div className="automation-stat">
            <span className="automation-stat-num">{flows.length}</span>
            <span className="automation-stat-label">Total Flows</span>
          </div>
          <div className="automation-stat">
            <span className="automation-stat-num">{flows.filter((f) => f.is_active).length}</span>
            <span className="automation-stat-label">Active</span>
          </div>
          <div className="automation-stat">
            <span className="automation-stat-num">{flows.filter((f) => !f.is_active).length}</span>
            <span className="automation-stat-label">Paused</span>
          </div>
        </div>
        <div className="automation-list-actions">
          <button className="automation-suggestions-btn" onClick={() => { setView('suggestions'); fetchSuggestions(); }}>
            <Lightbulb size={16} /> Smart Suggestions
          </button>
          <button className="automation-templates-btn" onClick={() => setShowTemplates(true)}>
            <Sparkles size={16} /> Templates
          </button>
          <button className="automation-create-btn" onClick={handleCreate}>
            <Plus size={18} /> Create Automation
          </button>
        </div>
      </div>

      {flows.length > 0 && (
        <div className="automation-filter-bar">
          <div className="automation-search-box">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search automations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select className="automation-filter-select" value={filterTrigger} onChange={(e) => setFilterTrigger(e.target.value)}>
            <option value="all">All Triggers</option>
            {TRIGGER_OPTIONS.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
          </select>
          <select className="automation-filter-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'paused')}>
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </select>
        </div>
      )}

      {error && <div className="crm-error-banner">{error}</div>}

      {loading ? (
        <div className="automation-loading">
          <Loader2 size={32} className="crm-spin" />
          <p>Loading automations...</p>
        </div>
      ) : flows.length === 0 ? (
        <div className="automation-empty">
          <div className="automation-empty-icon">
            <Zap size={48} />
          </div>
          <h3>No automations yet</h3>
          <p>Create your first automation to save time on repetitive tasks. Send instant replies, route leads, schedule follow-ups, and more.</p>
          <div className="automation-empty-actions">
            <button className="automation-templates-btn" onClick={() => setShowTemplates(true)}>
              <Sparkles size={18} /> Browse Templates
            </button>
            <button className="automation-create-btn" onClick={handleCreate}>
              <Plus size={18} /> Create from Scratch
            </button>
          </div>
        </div>
      ) : filteredFlows.length === 0 ? (
        <div className="automation-empty">
          <div className="automation-empty-icon" style={{ background: 'linear-gradient(135deg, #E0E7FF 0%, #94A3B8 100%)' }}>
            <Search size={48} />
          </div>
          <h3>No matching automations</h3>
          <p>No automations match your search. Try adjusting your filters.</p>
          <button className="automation-create-btn" onClick={() => { setSearchQuery(''); setFilterTrigger('all'); setFilterStatus('all'); }}>
            <X size={16} /> Clear Filters
          </button>
        </div>
      ) : (
        <div className="automation-flow-grid">
          {filteredFlows.map((flow) => {
            const trigger = TRIGGER_OPTIONS.find((t) => t.type === flow.trigger_type);
            const TriggerIcon = trigger?.icon || Zap;
            const stats = flowStats[flow.id];
            const convRate = stats && stats.total > 0 ? Math.round((stats.conversions / stats.total) * 100) : 0;
            return (
              <div key={flow.id} className={`automation-flow-card ${flow.is_active ? 'active' : 'paused'}`}>
                <div className="automation-flow-card-header">
                  <div className="automation-flow-trigger-badge" style={{ background: `${trigger?.color}15`, color: trigger?.color }}>
                    <TriggerIcon size={16} />
                    <span>{trigger?.label || flow.trigger_type}</span>
                  </div>
                  <label className="automation-toggle">
                    <input type="checkbox" checked={flow.is_active} onChange={() => handleToggleActive(flow)} />
                    <span className="automation-toggle-slider" />
                  </label>
                </div>
                <div className="automation-flow-card-body">
                  <h3>{flow.name}</h3>
                  <p>{flow.description || 'No description'}</p>
                  <div className="automation-flow-card-actions-count">
                    {flow.actions.length === 0 ? (
                      <span className="automation-no-actions">No actions configured</span>
                    ) : (
                      <>
                        <Zap size={12} />
                        <span>{flow.actions.length} action{flow.actions.length !== 1 ? 's' : ''}</span>
                      </>
                    )}
                  </div>
                  {flow.time_window_config && flow.time_window_config.enabled && (
                    <div className="automation-flow-card-time-window" title="Time window active">
                      <Calendar size={11} />
                      <span>Limited hours</span>
                    </div>
                  )}
                  {flow.webhook_url && (
                    <div className="automation-flow-card-webhook" title="External webhook trigger">
                      <ExternalLink size={11} />
                      <span>Webhook</span>
                    </div>
                  )}
                  {(() => {
                    if (!stats || stats.total === 0) {
                      return (
                        <div className="automation-flow-card-stats">
                          <div className="automation-flow-stat-item automation-flow-stat-muted">
                            <Activity size={12} />
                            <span>Never run</span>
                          </div>
                        </div>
                      );
                    }
                    const successRate = Math.round((stats.success / stats.total) * 100);
                    const lastRunDate = new Date(stats.lastRun!);
                    const now = new Date();
                    const diffMs = now.getTime() - lastRunDate.getTime();
                    const diffMins = Math.floor(diffMs / 60000);
                    const diffHours = Math.floor(diffMins / 60);
                    const diffDays = Math.floor(diffHours / 24);
                    let lastRunLabel: string;
                    if (diffMins < 1) lastRunLabel = 'just now';
                    else if (diffMins < 60) lastRunLabel = `${diffMins}m ago`;
                    else if (diffHours < 24) lastRunLabel = `${diffHours}h ago`;
                    else if (diffDays === 1) lastRunLabel = '1 day ago';
                    else lastRunLabel = `${diffDays} days ago`;
                    return (
                      <div className="automation-flow-card-stats">
                        <div className="automation-flow-stat-item" title="Total runs">
                          <Activity size={12} />
                          <span>{stats.total} run{stats.total !== 1 ? 's' : ''}</span>
                        </div>
                        <div className={`automation-flow-stat-item automation-flow-stat-${successRate >= 80 ? 'good' : successRate >= 50 ? 'warn' : 'bad'}`} title="Success rate">
                          <Check size={12} />
                          <span>{successRate}%</span>
                        </div>
                        {stats.conversions > 0 && (
                          <div className="automation-flow-stat-item automation-flow-stat-conv" title="Conversions from this automation">
                            <Target size={12} />
                            <span>{stats.conversions} conv ({convRate}%)</span>
                          </div>
                        )}
                        {stats.failed > 0 && (
                          <div className="automation-flow-stat-item automation-flow-stat-bad" title="Failed runs">
                            <AlertTriangle size={12} />
                            <span>{stats.failed}</span>
                          </div>
                        )}
                        <div className="automation-flow-stat-item automation-flow-stat-muted" title="Last run time">
                          <Clock size={12} />
                          <span>{lastRunLabel}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div className="automation-flow-card-footer">
                  <button className="automation-flow-action-btn" onClick={() => handleEdit(flow)} title="Edit">
                    <SettingsIcon size={15} /> Edit
                  </button>
                  <button className="automation-flow-action-btn" onClick={() => handleViewRuns(flow)} title="Run history">
                    <Eye size={15} /> History
                  </button>
                  <button className="automation-flow-action-btn" onClick={() => handleDuplicate(flow)} title="Duplicate">
                    <Copy size={15} /> Duplicate
                  </button>
                  <button className="automation-flow-action-btn automation-flow-delete" onClick={() => handleDelete(flow)} title="Delete">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showTemplates && (
        <div className="automation-template-overlay" onClick={() => setShowTemplates(false)}>
          <div className="automation-template-modal" onClick={(e) => e.stopPropagation()}>
            <div className="automation-template-modal-header">
              <div className="automation-template-modal-title">
                <Sparkles size={22} />
                <div>
                  <h2>Automation Templates</h2>
                  <p>Start with a pre-built workflow. You can customize it after.</p>
                </div>
              </div>
              <button className="automation-template-close" onClick={() => setShowTemplates(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="automation-template-categories">
              {templateCategories.map((cat) => (
                <button
                  key={cat}
                  className={`automation-template-category-btn ${templateCategory === cat ? 'active' : ''}`}
                  onClick={() => setTemplateCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="automation-template-grid">
              {filteredTemplates.map((tpl, idx) => {
                const trigger = TRIGGER_OPTIONS.find((t) => t.type === tpl.trigger_type);
                const TriggerIcon = trigger?.icon || Zap;
                return (
                  <div key={idx} className="automation-template-card">
                    <div className="automation-template-card-top">
                      <div className="automation-template-trigger-badge" style={{ background: `${trigger?.color}15`, color: trigger?.color }}>
                        <TriggerIcon size={14} />
                        <span>{trigger?.label}</span>
                      </div>
                      <span className="automation-template-category-tag">{tpl.category}</span>
                    </div>
                    <h3>{tpl.name}</h3>
                    <p>{tpl.description}</p>
                    <div className="automation-template-card-actions">
                      <div className="automation-template-action-count">
                        <Zap size={12} />
                        <span>{tpl.actions.length} action{tpl.actions.length !== 1 ? 's' : ''}</span>
                      </div>
                      <button className="automation-template-use-btn" onClick={() => handleUseTemplate(tpl)}>
                        <Plus size={14} /> Use Template
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===================== Flow Editor (Drag & Drop Builder) =====================

function FlowEditor({ flow, isNew, session, onBack, onSave }: {
  flow: AutomationFlow;
  isNew: boolean;
  session: Session;
  onBack: () => void;
  onSave: (flow: AutomationFlow) => Promise<void>;
}) {
  const [localFlow, setLocalFlow] = useState<AutomationFlow>(flow);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [expandedAction, setExpandedAction] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<{ id: string; email: string; full_name: string | null }[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<{ id: string; name: string; subject: string }[]>([]);
  const [draggedActionIdx, setDraggedActionIdx] = useState<number | null>(null);
  const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);
  const [addActionOpen, setAddActionOpen] = useState(false);
  const addActionRef = useRef<HTMLDivElement>(null);
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [testLead, setTestLead] = useState({ name: 'Test Lead', email: 'test@example.com', phone: '+1234567890', status: 'new', product: 'algo', fund_amount: '5000', state: 'California' });
  const [testRunning, setTestRunning] = useState(false);
  const [testResults, setTestResults] = useState<string[] | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: members }, { data: templates }] = await Promise.all([
        supabase.from('team_members').select('id, email, full_name').eq('status', 'active').order('created_at'),
        supabase.from('email_templates').select('id, name, subject').eq('is_active', true).order('name'),
      ]);
      if (members) setTeamMembers(members as typeof teamMembers);
      if (templates) setEmailTemplates(templates as typeof emailTemplates);
    })();
  }, []);

  useEffect(() => {
    if (!addActionOpen) return;
    const handler = (e: MouseEvent) => {
      if (addActionRef.current && !addActionRef.current.contains(e.target as Node)) {
        setAddActionOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [addActionOpen]);

  const updateFlow = (updates: Partial<AutomationFlow>) => {
    setLocalFlow((prev) => ({ ...prev, ...updates }));
  };

  const addAction = (type: ActionType) => {
    const newAction: FlowAction = {
      id: genId(),
      type,
      config: getDefaultConfig(type),
    };
    updateFlow({ actions: [...localFlow.actions, newAction] });
    setExpandedAction(newAction.id);
  };

  const removeAction = (id: string) => {
    updateFlow({ actions: localFlow.actions.filter((a) => a.id !== id) });
  };

  const updateAction = (id: string, config: Record<string, unknown>) => {
    updateFlow({
      actions: localFlow.actions.map((a) => (a.id === id ? { ...a, config: { ...a.config, ...config } } : a)),
    });
  };

  const duplicateAction = (id: string) => {
    const action = localFlow.actions.find((a) => a.id === id);
    if (!action) return;
    const newAction: FlowAction = { ...action, id: genId(), config: { ...action.config } };
    const idx = localFlow.actions.findIndex((a) => a.id === id);
    const newActions = [...localFlow.actions];
    newActions.splice(idx + 1, 0, newAction);
    updateFlow({ actions: newActions });
  };

  const moveAction = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0) return;
    const newActions = [...localFlow.actions];
    const [moved] = newActions.splice(fromIdx, 1);
    newActions.splice(toIdx, 0, moved);
    updateFlow({ actions: newActions });
  };

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDraggedActionIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetIdx(idx);
  };

  const handleDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedActionIdx !== null) {
      moveAction(draggedActionIdx, idx);
    }
    setDraggedActionIdx(null);
    setDropTargetIdx(null);
  };

  const handleDragEnd = () => {
    setDraggedActionIdx(null);
    setDropTargetIdx(null);
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(localFlow);
    setSaving(false);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const handleTestRun = async () => {
    setTestRunning(true);
    setTestResults(null);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-automations`;
      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: 'test_run',
          flow_id: localFlow.id.startsWith('temp_') ? null : localFlow.id,
          test_lead: {
            full_name: testLead.name,
            email: testLead.email,
            mobile_number: testLead.phone,
            status: testLead.status,
            trading_product: testLead.product,
            fund_amount: testLead.fund_amount,
            state: testLead.state,
          },
        }),
      });
      const result = await resp.json();
      if (result.success) {
        setTestResults(result.summary || []);
      } else {
        setTestResults([`Error: ${result.error || 'Test run failed'}`]);
      }
    } catch (err) {
      setTestResults([`Error: ${(err as Error).message}`]);
    } finally {
      setTestRunning(false);
    }
  };

  const generateWebhookUrl = () => {
    const slug = genId().replace('act_', 'wh_');
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-automations`;
    updateFlow({ webhook_url: slug, trigger_type: 'webhook_received' });
    void slug;
    void url;
  };

  const trigger = TRIGGER_OPTIONS.find((t) => t.type === localFlow.trigger_type);
  const TriggerIcon = trigger?.icon || Zap;

  const validActions = localFlow.actions.length;
  const canSave = localFlow.name.trim().length > 0 && validActions > 0;
  const twConfig = localFlow.time_window_config || {};

  const toggleDay = (day: number) => {
    const days = ((twConfig.days as number[]) || [0, 1, 2, 3, 4, 5, 6]);
    const newDays = days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort();
    updateFlow({ time_window_config: { ...twConfig, days: newDays } });
  };

  return (
    <div className="automation-editor">
      <div className="automation-editor-header">
        <div className="automation-editor-header-left">
          <button className="dash-back-btn" onClick={onBack}><ArrowLeft size={18} /> Back</button>
          <div className="automation-editor-title-section">
            <input
              className="automation-editor-name-input"
              value={localFlow.name}
              onChange={(e) => updateFlow({ name: e.target.value })}
              placeholder="Automation name"
            />
            <input
              className="automation-editor-desc-input"
              value={localFlow.description}
              onChange={(e) => updateFlow({ description: e.target.value })}
              placeholder="Add a description..."
            />
          </div>
        </div>
        <div className="automation-editor-header-right">
          <button className="automation-test-btn" onClick={() => setShowTestPanel((v) => !v)} disabled={validActions === 0}>
            <FlaskConical size={16} /> Test
          </button>
          {savedNotice && <span className="automation-saved-notice"><Check size={14} /> Saved</span>}
          <button className="automation-save-btn" onClick={handleSave} disabled={saving || !canSave}>
            {saving ? <Loader2 size={16} className="crm-spin" /> : <Save size={16} />}
            {saving ? 'Saving...' : isNew ? 'Create' : 'Save'}
          </button>
        </div>
      </div>

      {!canSave && (
        <div className="automation-editor-warning">
          <AlertTriangle size={14} />
          <span>{localFlow.name.trim().length === 0 ? 'Add a name' : 'Add at least one action'} to save this automation.</span>
        </div>
      )}

      {showTestPanel && (
        <div className="automation-test-panel">
          <div className="automation-test-panel-header">
            <FlaskConical size={18} />
            <div>
              <strong>Test / Preview Run</strong>
              <p>Simulate this automation with a fake lead to see what would happen. No real messages are sent.</p>
            </div>
            <button className="automation-test-close" onClick={() => setShowTestPanel(false)}><X size={16} /></button>
          </div>
          <div className="automation-test-panel-body">
            <div className="automation-test-fields">
              <div className="automation-test-field">
                <label>Lead Name</label>
                <input value={testLead.name} onChange={(e) => setTestLead({ ...testLead, name: e.target.value })} />
              </div>
              <div className="automation-test-field">
                <label>Email</label>
                <input value={testLead.email} onChange={(e) => setTestLead({ ...testLead, email: e.target.value })} />
              </div>
              <div className="automation-test-field">
                <label>Phone</label>
                <input value={testLead.phone} onChange={(e) => setTestLead({ ...testLead, phone: e.target.value })} />
              </div>
              <div className="automation-test-field">
                <label>Status</label>
                <select value={testLead.status} onChange={(e) => setTestLead({ ...testLead, status: e.target.value })}>
                  {PIPELINE_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
              <div className="automation-test-field">
                <label>Product</label>
                <select value={testLead.product} onChange={(e) => setTestLead({ ...testLead, product: e.target.value })}>
                  {PRODUCTS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
              </div>
              <div className="automation-test-field">
                <label>Fund Amount</label>
                <input value={testLead.fund_amount} onChange={(e) => setTestLead({ ...testLead, fund_amount: e.target.value })} />
              </div>
            </div>
            <button className="automation-test-run-btn" onClick={handleTestRun} disabled={testRunning}>
              {testRunning ? <Loader2 size={16} className="crm-spin" /> : <Play size={16} />}
              {testRunning ? 'Running...' : 'Run Test'}
            </button>
            {testResults && (
              <div className="automation-test-results">
                <div className="automation-test-results-header">
                  <Check size={16} /> Simulation Results
                </div>
                {testResults.length === 0 ? (
                  <p className="automation-test-no-results">No actions would execute.</p>
                ) : (
                  <div className="automation-test-results-list">
                    {testResults.map((r, i) => (
                      <div key={i} className="automation-test-result-item">
                        <span className="automation-test-result-step">{i + 1}</span>
                        <span className="automation-test-result-text">{r}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="automation-editor-canvas">
        {/* Trigger Node */}
        <div className="automation-canvas-section">
          <div className="automation-section-label">TRIGGER</div>
          <div className="automation-trigger-node" style={{ borderColor: trigger?.color }}>
            <div className="automation-node-icon" style={{ background: trigger?.color }}>
              <TriggerIcon size={20} />
            </div>
            <div className="automation-node-body">
              <span className="automation-node-type">When this happens...</span>
              <strong>{trigger?.label || localFlow.trigger_type}</strong>
              <span className="automation-node-desc">{trigger?.desc}</span>
            </div>
            <select
              className="automation-trigger-select"
              value={localFlow.trigger_type}
              onChange={(e) => updateFlow({ trigger_type: e.target.value as TriggerType, trigger_config: {} })}
            >
              {TRIGGER_OPTIONS.map((t) => (
                <option key={t.type} value={t.type}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Trigger config filters */}
          <TriggerConfig flow={localFlow} updateFlow={updateFlow} teamMembers={teamMembers} />

          {/* Webhook trigger URL */}
          {localFlow.trigger_type === 'webhook_received' && (
            <div className="automation-webhook-config">
              <label>Webhook URL</label>
              <div className="automation-webhook-url-row">
                <input
                  readOnly
                  value={localFlow.webhook_url ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-automations` : 'Generate a URL to enable external triggers'}
                  className="automation-webhook-url-input"
                />
                <button className="automation-webhook-gen-btn" onClick={generateWebhookUrl}>
                  <Webhook size={14} /> {localFlow.webhook_url ? 'Regenerate' : 'Generate URL'}
                </button>
              </div>
              {localFlow.webhook_url && (
                <p className="automation-webhook-hint">
                  Send a POST request with lead data to this URL to trigger the automation. Payload example: <code>{'{ "lead_data": { "full_name": "John", "email": "john@test.com" } }'}</code>
                </p>
              )}
            </div>
          )}

          {/* Time Window Config */}
          <div className="automation-time-window">
            <div className="automation-time-window-header">
              <Calendar size={16} />
              <span>Time Window</span>
              <label className="automation-toggle automation-toggle-sm">
                <input
                  type="checkbox"
                  checked={(twConfig.enabled as boolean) || false}
                  onChange={(e) => updateFlow({ time_window_config: { ...twConfig, enabled: e.target.checked, days: (twConfig.days as number[]) || [1, 2, 3, 4, 5], start_hour: (twConfig.start_hour as number) ?? 9, end_hour: (twConfig.end_hour as number) ?? 18 } })}
                />
                <span className="automation-toggle-slider" />
              </label>
            </div>
            {twConfig.enabled && (
              <div className="automation-time-window-config">
                <div className="automation-time-window-days">
                  {DAYS_OF_WEEK.map((d) => (
                    <button
                      key={d.key}
                      className={`automation-day-btn ${((twConfig.days as number[]) || []).includes(d.key) ? 'active' : ''}`}
                      onClick={() => toggleDay(d.key)}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                <div className="automation-time-window-hours">
                  <div className="automation-time-window-field">
                    <label>From</label>
                    <select value={(twConfig.start_hour as number) ?? 9} onChange={(e) => updateFlow({ time_window_config: { ...twConfig, start_hour: parseInt(e.target.value) } })}>
                      {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{i}:00</option>)}
                    </select>
                  </div>
                  <div className="automation-time-window-field">
                    <label>To</label>
                    <select value={(twConfig.end_hour as number) ?? 18} onChange={(e) => updateFlow({ time_window_config: { ...twConfig, end_hour: parseInt(e.target.value) } })}>
                      {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{i}:00</option>)}
                    </select>
                  </div>
                </div>
                <p className="automation-time-window-note">Actions will only fire during these hours. Delayed actions queued outside the window execute at the next available time.</p>
              </div>
            )}
          </div>
        </div>

        {/* Arrow down */}
        {localFlow.actions.length > 0 && (
          <div className="automation-canvas-arrow">
            <ArrowDown size={20} />
          </div>
        )}

        {/* Actions */}
        <div className="automation-canvas-section">
          <div className="automation-section-label">ACTIONS</div>
          <div className="automation-actions-list">
            {localFlow.actions.map((action, idx) => {
              const meta = ACTION_PALETTE.find((a) => a.type === action.type);
              const ActionIcon = meta?.icon || Zap;
              const isExpanded = expandedAction === action.id;
              const isDragging = draggedActionIdx === idx;
              const isDropTarget = dropTargetIdx === idx;
              return (
                <div key={action.id}>
                  {idx > 0 && (
                    <div
                      className={`automation-action-connector ${isDropTarget ? 'drop-target' : ''}`}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDrop={(e) => handleDrop(e, idx)}
                    />
                  )}
                  <div
                    className={`automation-action-node ${isDragging ? 'dragging' : ''} ${isDropTarget && idx === 0 ? 'drop-target-first' : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={(e) => handleDrop(e, idx)}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="automation-action-node-grip">
                      <GripVertical size={14} />
                    </div>
                    <div className="automation-node-icon" style={{ background: meta?.color }}>
                      <ActionIcon size={18} />
                    </div>
                    <div className="automation-node-body">
                      <span className="automation-node-type">{meta?.label || action.type}</span>
                      <strong>{getActionSummary(action)}</strong>
                    </div>
                    <div className="automation-action-node-controls">
                      <button className="automation-node-expand" onClick={() => setExpandedAction(isExpanded ? null : action.id)}>
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                      <button className="automation-node-btn" onClick={() => duplicateAction(action.id)} title="Duplicate">
                        <Copy size={14} />
                      </button>
                      <button className="automation-node-btn automation-node-delete" onClick={() => removeAction(action.id)} title="Remove">
                        <X size={14} />
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="automation-action-config">
                        <ActionConfig action={action} updateConfig={(cfg) => updateAction(action.id, cfg)} teamMembers={teamMembers} emailTemplates={emailTemplates} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {localFlow.actions.length === 0 && (
            <div className="automation-no-actions-placeholder">
              <p>Drag or click actions from the sidebar to build your workflow</p>
            </div>
          )}

          {/* Add action button */}
          <div className="automation-add-action-zone" ref={addActionRef}>
            <button className="automation-add-action-btn" onClick={() => setAddActionOpen((v) => !v)}>
              <Plus size={16} /> Add Action
            </button>
            {addActionOpen && (
              <div className="automation-add-action-menu automation-add-action-menu-open">
                {['Messages', 'Lead', 'Control', 'Integrations'].map((group) => (
                  <div key={group} className="automation-add-action-group">
                    <span className="automation-add-action-group-label">{group}</span>
                    {ACTION_PALETTE.filter((a) => a.group === group).map((a) => {
                      const Icon = a.icon;
                      return (
                        <button key={a.type} className="automation-add-action-item" onClick={() => { addAction(a.type); setAddActionOpen(false); }}>
                          <span className="automation-add-action-item-icon" style={{ background: `${a.color}20`, color: a.color }}>
                            <Icon size={14} />
                          </span>
                          <div>
                            <strong>{a.label}</strong>
                            <span>{a.desc}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action palette sidebar */}
      <div className="automation-palette-sidebar">
        <div className="automation-palette-header">
          <Zap size={16} />
          <span>Action Blocks</span>
        </div>
        <p className="automation-palette-hint">Click to add to your workflow</p>
        {['Messages', 'Lead', 'Control', 'Integrations'].map((group) => (
          <div key={group} className="automation-palette-group">
            <span className="automation-palette-group-label">{group}</span>
            {ACTION_PALETTE.filter((a) => a.group === group).map((a) => {
              const Icon = a.icon;
              return (
                <button key={a.type} className="automation-palette-item" onClick={() => addAction(a.type)}>
                  <span className="automation-palette-item-icon" style={{ background: `${a.color}20`, color: a.color }}>
                    <Icon size={15} />
                  </span>
                  <div className="automation-palette-item-body">
                    <strong>{a.label}</strong>
                    <span>{a.desc}</span>
                  </div>
                  <Plus size={14} className="automation-palette-add-icon" />
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ===================== Trigger Config =====================

function TriggerConfig({ flow, updateFlow, teamMembers }: {
  flow: AutomationFlow;
  updateFlow: (updates: Partial<AutomationFlow>) => void;
  teamMembers: { id: string; email: string; full_name: string | null }[];
}) {
  const cfg = flow.trigger_config;
  const setCfg = (key: string, value: unknown) => {
    updateFlow({ trigger_config: { ...cfg, [key]: value } });
  };

  if (flow.trigger_type === 'lead_created') {
    return (
      <div className="automation-trigger-config">
        <label>Only trigger for:</label>
        <select value={(cfg.product as string) || ''} onChange={(e) => setCfg('product', e.target.value || undefined)}>
          <option value="">All products</option>
          {PRODUCTS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
      </div>
    );
  }

  if (flow.trigger_type === 'lead_status_changed') {
    return (
      <div className="automation-trigger-config">
        <label>When status changes to:</label>
        <select value={(cfg.status as string) || ''} onChange={(e) => setCfg('status', e.target.value || undefined)}>
          <option value="">Any status</option>
          {PIPELINE_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>
    );
  }

  if (flow.trigger_type === 'lead_tagged') {
    return (
      <div className="automation-trigger-config">
        <label>When tag is:</label>
        <input
          placeholder="Enter tag name..."
          value={(cfg.tag as string) || ''}
          onChange={(e) => setCfg('tag', e.target.value || undefined)}
        />
      </div>
    );
  }

  if (flow.trigger_type === 'lead_assigned') {
    return (
      <div className="automation-trigger-config">
        <label>When assigned to:</label>
        <select value={(cfg.assignee_email as string) || ''} onChange={(e) => setCfg('assignee_email', e.target.value || undefined)}>
          <option value="">Any team member</option>
          {teamMembers.map((m) => <option key={m.id} value={m.email}>{m.full_name || m.email}</option>)}
        </select>
      </div>
    );
  }

  return null;
}

// ===================== Action Config Panel =====================

function ActionConfig({ action, updateConfig, teamMembers, emailTemplates }: {
  action: FlowAction;
  updateConfig: (cfg: Record<string, unknown>) => void;
  teamMembers: { id: string; email: string; full_name: string | null }[];
  emailTemplates: { id: string; name: string; subject: string }[];
}) {
  const cfg = action.config;

  if (action.type === 'send_email') {
    return (
      <div className="automation-config-grid">
        <div className="automation-config-field">
          <label>Email Template</label>
          <select value={(cfg.template_id as string) || ''} onChange={(e) => updateConfig({ template_id: e.target.value })}>
            <option value="">Select template...</option>
            {emailTemplates.map((t) => <option key={t.id} value={t.id}>{t.name} — {t.subject}</option>)}
          </select>
        </div>
        <div className="automation-config-field automation-config-full">
          <label>Or custom subject</label>
          <input placeholder="Email subject..." value={(cfg.subject as string) || ''} onChange={(e) => updateConfig({ subject: e.target.value })} />
        </div>
        <div className="automation-config-field automation-config-full">
          <label>Or custom body (supports {'{{lead_name}}'}, {'{{lead_email}}'}, etc.)</label>
          <textarea rows={4} placeholder="Email body..." value={(cfg.body as string) || ''} onChange={(e) => updateConfig({ body: e.target.value })} />
        </div>
      </div>
    );
  }

  if (action.type === 'send_whatsapp') {
    return (
      <div className="automation-config-grid">
        <div className="automation-config-field automation-config-full">
          <label>Message (supports {'{{lead_name}}'}, {'{{lead_phone}}'}, etc.)</label>
          <textarea rows={3} placeholder="Type your WhatsApp message..." value={(cfg.message as string) || ''} onChange={(e) => updateConfig({ message: e.target.value })} />
        </div>
      </div>
    );
  }

  if (action.type === 'send_telegram') {
    return (
      <div className="automation-config-grid">
        <div className="automation-config-field automation-config-full">
          <label>Message (supports {'{{lead_name}}'}, {'{{lead_email}}'}, etc.)</label>
          <textarea rows={3} placeholder="Type your Telegram message..." value={(cfg.message as string) || ''} onChange={(e) => updateConfig({ message: e.target.value })} />
        </div>
      </div>
    );
  }

  if (action.type === 'send_notification') {
    return (
      <div className="automation-config-grid">
        <div className="automation-config-field automation-config-full">
          <label>Notification message</label>
          <textarea rows={2} placeholder="Message to post in team chat..." value={(cfg.message as string) || ''} onChange={(e) => updateConfig({ message: e.target.value })} />
        </div>
      </div>
    );
  }

  if (action.type === 'assign_lead') {
    return (
      <div className="automation-config-grid">
        <div className="automation-config-field automation-config-full">
          <label>Assign to</label>
          <select value={(cfg.assignee_email as string) || ''} onChange={(e) => updateConfig({ assignee_email: e.target.value })}>
            <option value="">Select team member...</option>
            {teamMembers.map((m) => <option key={m.id} value={m.email}>{m.full_name || m.email}</option>)}
          </select>
        </div>
      </div>
    );
  }

  if (action.type === 'add_tag') {
    return (
      <div className="automation-config-grid">
        <div className="automation-config-field automation-config-full">
          <label>Tag to add</label>
          <input placeholder="e.g. hot-lead, follow-up..." value={(cfg.tag as string) || ''} onChange={(e) => updateConfig({ tag: e.target.value })} />
        </div>
      </div>
    );
  }

  if (action.type === 'change_status') {
    return (
      <div className="automation-config-grid">
        <div className="automation-config-field automation-config-full">
          <label>New status</label>
          <select value={(cfg.status as string) || ''} onChange={(e) => updateConfig({ status: e.target.value })}>
            <option value="">Select status...</option>
            {PIPELINE_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
      </div>
    );
  }

  if (action.type === 'schedule_followup') {
    return (
      <div className="automation-config-grid">
        <div className="automation-config-field">
          <label>Title</label>
          <input placeholder="Follow-up title..." value={(cfg.title as string) || ''} onChange={(e) => updateConfig({ title: e.target.value })} />
        </div>
        <div className="automation-config-field">
          <label>Days from now</label>
          <input type="number" min={1} placeholder="3" value={(cfg.days as string) || ''} onChange={(e) => updateConfig({ days: e.target.value })} />
        </div>
        <div className="automation-config-field automation-config-full">
          <label>Note (optional)</label>
          <input placeholder="Follow-up note..." value={(cfg.note as string) || ''} onChange={(e) => updateConfig({ note: e.target.value })} />
        </div>
      </div>
    );
  }

  if (action.type === 'delay') {
    return (
      <div className="automation-config-grid">
        <div className="automation-config-field">
          <label>Minutes</label>
          <input type="number" min={0} placeholder="0" value={(cfg.minutes as string) || ''} onChange={(e) => updateConfig({ minutes: e.target.value })} />
        </div>
        <div className="automation-config-field">
          <label>Hours</label>
          <input type="number" min={0} placeholder="0" value={(cfg.hours as string) || ''} onChange={(e) => updateConfig({ hours: e.target.value })} />
        </div>
        <div className="automation-config-field">
          <label>Days</label>
          <input type="number" min={0} placeholder="1" value={(cfg.days as string) || ''} onChange={(e) => updateConfig({ days: e.target.value })} />
        </div>
      </div>
    );
  }

  if (action.type === 'condition') {
    const branch = (cfg.branch as string) || 'stop';
    return (
      <div className="automation-config-grid">
        <div className="automation-config-field">
          <label>Field</label>
          <select value={(cfg.field as string) || ''} onChange={(e) => updateConfig({ field: e.target.value })}>
            <option value="">Select field...</option>
            {CONDITION_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
        </div>
        <div className="automation-config-field">
          <label>Operator</label>
          <select value={(cfg.operator as string) || ''} onChange={(e) => updateConfig({ operator: e.target.value })}>
            <option value="">Select operator...</option>
            {CONDITION_OPERATORS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>
        <div className="automation-config-field">
          <label>Value</label>
          <input placeholder="Compare value..." value={(cfg.value as string) || ''} onChange={(e) => updateConfig({ value: e.target.value })} />
        </div>
        <div className="automation-config-field automation-config-full">
          <label>If condition is FALSE:</label>
          <div className="automation-condition-branch-options">
            <button
              className={`automation-condition-branch-btn ${branch === 'stop' ? 'active' : ''}`}
              onClick={() => updateConfig({ branch: 'stop' })}
            >
              Stop the flow
            </button>
            <button
              className={`automation-condition-branch-btn ${branch === 'else' ? 'active' : ''}`}
              onClick={() => updateConfig({ branch: 'else' })}
            >
              Run ELSE actions
            </button>
          </div>
        </div>
        {branch === 'else' && (
          <div className="automation-config-field automation-config-full">
            <label>ELSE Actions (one per line: type|config_json)</label>
            <textarea
              rows={3}
              placeholder={'send_whatsapp|{"message":"Fallback message"}\nsend_notification|{"message":"Condition was false"}'}
              value={(cfg.else_actions_text as string) || ''}
              onChange={(e) => {
                const text = e.target.value;
                const elseActions: { type: string; config: Record<string, unknown> }[] = [];
                for (const line of text.split('\n').filter((l) => l.trim())) {
                  const [type, ...rest] = line.split('|');
                  try {
                    const config = JSON.parse(rest.join('|').trim());
                    elseActions.push({ type: type.trim(), config });
                  } catch {
                    // skip malformed lines
                  }
                }
                updateConfig({ else_actions_text: text, else_actions: elseActions });
              }}
            />
            <span className="automation-config-note">When the condition is false, these actions run instead of stopping. Format: action_type|{'{ "key": "value" }'}</span>
          </div>
        )}
      </div>
    );
  }

  if (action.type === 'fire_webhook') {
    return (
      <div className="automation-config-grid">
        <div className="automation-config-field">
          <label>Method</label>
          <select value={(cfg.method as string) || 'POST'} onChange={(e) => updateConfig({ method: e.target.value })}>
            <option value="POST">POST</option>
            <option value="GET">GET</option>
            <option value="PUT">PUT</option>
          </select>
        </div>
        <div className="automation-config-field automation-config-full">
          <label>Webhook URL</label>
          <input placeholder="https://..." value={(cfg.url as string) || ''} onChange={(e) => updateConfig({ url: e.target.value })} />
        </div>
      </div>
    );
  }

  return null;
}

// ===================== Runs History View =====================

function RunsView({ flow, runs, loading, onBack }: {
  flow: AutomationFlow;
  runs: AutomationRun[];
  loading: boolean;
  onBack: () => void;
}) {
  const statusColor = (status: string) => {
    if (status === 'success') return '#22C55E';
    if (status === 'failed') return '#EF4444';
    if (status === 'running') return '#3B82F6';
    if (status === 'delayed') return '#F59E0B';
    return '#64748B';
  };

  return (
    <div className="automation-builder">
      <div className="dash-page-header">
        <button className="dash-back-btn" onClick={onBack}><ArrowLeft size={18} /> Back</button>
        <h1>Run History — {flow.name}</h1>
        <p>Last 50 executions of this automation</p>
      </div>

      {loading ? (
        <div className="automation-loading">
          <Loader2 size={32} className="crm-spin" />
          <p>Loading run history...</p>
        </div>
      ) : runs.length === 0 ? (
        <div className="automation-empty">
          <div className="automation-empty-icon"><Eye size={48} /></div>
          <h3>No runs yet</h3>
          <p>This automation hasn't been triggered yet. It will appear here once it runs.</p>
        </div>
      ) : (
        <div className="automation-runs-list">
          {runs.map((run) => (
            <div key={run.id} className={`automation-run-row ${run.is_test ? 'automation-run-row-test' : ''}`}>
              <div className="automation-run-status-dot" style={{ background: statusColor(run.status) }} />
              <div className="automation-run-info">
                <span className="automation-run-status-text" style={{ color: statusColor(run.status) }}>
                  {run.is_test && <FlaskConical size={12} style={{ display: 'inline', marginRight: 4 }} />}
                  {run.status}
                </span>
                <span className="automation-run-time">{new Date(run.created_at).toLocaleString()}</span>
                {run.result_summary && (
                  <span className="automation-run-summary">{run.result_summary.slice(0, 120)}{run.result_summary.length > 120 ? '...' : ''}</span>
                )}
              </div>
              <div className="automation-run-lead">
                {run.lead_id ? <span>Lead: {run.lead_id.slice(0, 8)}...</span> : <span>—</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===================== Smart Suggestions View =====================

function SuggestionsView({ suggestions, loading, onBack, onRefresh, onDismiss, onCreateAutomation }: {
  suggestions: Suggestion[];
  loading: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onDismiss: (id: string) => void;
  onCreateAutomation: () => void;
}) {
  const confidenceColor = (c: number) => {
    if (c >= 0.8) return '#22C55E';
    if (c >= 0.6) return '#F59E0B';
    return '#94A3B8';
  };

  return (
    <div className="automation-builder">
      <div className="dash-page-header">
        <button className="dash-back-btn" onClick={onBack}><ArrowLeft size={18} /> Back</button>
        <h1>Smart Suggestions</h1>
        <p>AI-powered recommendations based on your lead data and automation performance</p>
      </div>

      <div className="automation-suggestions-header">
        <div className="automation-suggestions-info">
          <Bot size={20} />
          <span>{suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''} found</span>
        </div>
        <button className="automation-suggestions-refresh" onClick={onRefresh} disabled={loading}>
          {loading ? <Loader2 size={16} className="crm-spin" /> : <RefreshCw size={16} />}
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="automation-loading">
          <Loader2 size={32} className="crm-spin" />
          <p>Analyzing your leads and automations...</p>
        </div>
      ) : suggestions.length === 0 ? (
        <div className="automation-empty">
          <div className="automation-empty-icon" style={{ background: 'linear-gradient(135deg, #D1FAE5 0%, #6EE7B7 100%)' }}>
            <Check size={48} />
          </div>
          <h3>No suggestions right now</h3>
          <p>Your automations look well-configured. Check back later as you get more leads and runs.</p>
          <button className="automation-create-btn" onClick={onCreateAutomation}>
            <Plus size={18} /> Create Automation
          </button>
        </div>
      ) : (
        <div className="automation-suggestions-list">
          {suggestions.map((s) => (
            <div key={s.id} className="automation-suggestion-card">
              <div className="automation-suggestion-card-header">
                <div className="automation-suggestion-icon">
                  <Lightbulb size={20} />
                </div>
                <div className="automation-suggestion-meta">
                  <h3>{s.title}</h3>
                  <div className="automation-suggestion-badge-row">
                    <span className="automation-suggestion-type">{s.suggestion_type.replace(/_/g, ' ')}</span>
                    <span className="automation-suggestion-confidence" style={{ color: confidenceColor(s.confidence) }}>
                      {Math.round(s.confidence * 100)}% confidence
                    </span>
                  </div>
                </div>
                <button className="automation-suggestion-dismiss" onClick={() => onDismiss(s.id)} title="Dismiss">
                  <X size={16} />
                </button>
              </div>
              <p className="automation-suggestion-desc">{s.description}</p>
              <div className="automation-suggestion-actions">
                <button className="automation-suggestion-apply" onClick={onCreateAutomation}>
                  <Plus size={14} /> Create Automation
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===================== Helpers =====================

function getDefaultConfig(type: ActionType): Record<string, unknown> {
  switch (type) {
    case 'delay':
      return { minutes: '0', hours: '0', days: '1' };
    case 'condition':
      return { field: '', operator: '', value: '', branch: 'stop' };
    case 'fire_webhook':
      return { method: 'POST', url: '' };
    case 'change_status':
      return { status: '' };
    case 'schedule_followup':
      return { title: '', days: '3', note: '' };
    default:
      return {};
  }
}

function getActionSummary(action: FlowAction): string {
  const c = action.config;
  switch (action.type) {
    case 'send_email':
      return (c.subject as string) || (c.template_id as string ? 'Using template' : 'Configure email');
    case 'send_whatsapp':
      return ((c.message as string) || '').slice(0, 50) || 'Configure message';
    case 'send_telegram':
      return ((c.message as string) || '').slice(0, 50) || 'Configure message';
    case 'send_notification':
      return ((c.message as string) || '').slice(0, 50) || 'Configure notification';
    case 'assign_lead':
      return (c.assignee_email as string) || 'Select team member';
    case 'add_tag':
      return (c.tag as string) || 'Enter tag name';
    case 'change_status':
      return PIPELINE_STAGES.find((s) => s.key === (c.status as string))?.label || 'Select status';
    case 'schedule_followup':
      return c.title as string || c.days as string ? `In ${c.days || '3'} days` : 'Configure follow-up';
    case 'delay': {
      const mins = parseInt((c.minutes as string) || '0') || 0;
      const hours = parseInt((c.hours as string) || '0') || 0;
      const days = parseInt((c.days as string) || '0') || 0;
      const totalMin = mins + hours * 60 + days * 1440;
      if (totalMin >= 1440) return `Wait ${Math.floor(totalMin / 1440)} day(s)`;
      if (totalMin >= 60) return `Wait ${Math.floor(totalMin / 60)} hour(s)`;
      return `Wait ${totalMin} min`;
    }
    case 'condition': {
      const field = CONDITION_FIELDS.find((f) => f.key === (c.field as string))?.label || '...';
      const op = CONDITION_OPERATORS.find((o) => o.key === (c.operator as string))?.label || '...';
      const branch = (c.branch as string) === 'else' ? ' (with ELSE)' : '';
      return `${field} ${op} ${c.value || '...'}${branch}`;
    }
    case 'fire_webhook':
      return (c.url as string) || 'Configure URL';
    default:
      return 'Configure';
  }
}
