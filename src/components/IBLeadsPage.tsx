import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import {
  Users, Search, Download, Mail, Phone, MapPin,
  ChevronLeft, ChevronRight, Loader2, ArrowUpRight, ArrowLeft,
  Clock, Filter, Table as TableIcon, LayoutGrid, X,
  Star, Trash2, AlertTriangle,
  Plus, Zap, Tag,
  Calendar, Shuffle,
  CheckCircle2, XCircle, FileText, Building2, Award, TrendingUp,
  MessageCircle, Pencil, Upload, SlidersHorizontal, Eye, EyeOff,
} from 'lucide-react';

type IbLeadStatus = 'new' | 'contacted' | 'docs_requested' | 'docs_received' | 'approved' | 'rejected';
type IbType = 'standard' | 'premium' | 'white_label';
type SortKey = 'created_at' | 'full_name' | 'state' | 'status' | 'broker_name';
type SortDir = 'asc' | 'desc';
type ViewMode = 'table' | 'pipeline';
type IbMobileStatKey = 'total' | 'approved' | 'docs' | 'today' | 'rejected' | 'volume';

const IB_MOBILE_STAT_OPTIONS: { key: IbMobileStatKey; label: string }[] = [
  { key: 'total', label: 'Total IB Leads' },
  { key: 'approved', label: 'Approved' },
  { key: 'docs', label: 'Docs Received' },
  { key: 'today', label: 'New Today' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'volume', label: 'Expected Volume' },
];

type DateFilterPreset = 'all' | 'today' | 'yesterday' | 'last_7_days' | 'this_week' | 'this_month' | 'this_year' | 'custom';

type IbLead = {
  id: string;
  full_name: string;
  mobile_number: string;
  email: string;
  state: string;
  country_of_residence: string | null;
  current_ib_affiliate: string | null;
  network_size: string | null;
  client_acquisition_method: string | null;
  business_type: string | null;
  monthly_referral_capacity: string | null;
  partnership_need: string | null;
  broker_name: string | null;
  ib_type: IbType;
  commission_level: string | null;
  status: IbLeadStatus;
  tags: string[];
  notes: string;
  fund_amount: number | null;
  assigned_to: string | null;
  last_contacted_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
  lead_score: number;
};

type IbLeadForm = {
  full_name: string;
  email: string;
  mobile_number: string;
  country_of_residence: string;
  business_type: string;
  broker_name: string;
  network_size: string;
  status: IbLeadStatus;
  notes: string;
};

type TeamMember = {
  id: string;
  email: string;
  full_name: string | null;
};

const PAGE_SIZE = 10;

const IB_PIPELINE_STAGES: { key: IbLeadStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { key: 'new', label: 'New', icon: <Users size={15} />, color: 'blue' },
  { key: 'contacted', label: 'Contacted', icon: <Phone size={15} />, color: 'cyan' },
  { key: 'docs_requested', label: 'Docs Requested', icon: <FileText size={15} />, color: 'orange' },
  { key: 'docs_received', label: 'Docs Received', icon: <CheckCircle2 size={15} />, color: 'green' },
  { key: 'approved', label: 'Approved', icon: <Award size={15} />, color: 'gold' },
  { key: 'rejected', label: 'Rejected', icon: <XCircle size={15} />, color: 'red' },
];

const STAGE_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  blue: { bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)', text: '#2563EB', dot: '#3B82F6' },
  orange: { bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.3)', text: '#EA580C', dot: '#F97316' },
  cyan: { bg: 'rgba(6,182,212,0.1)', border: 'rgba(6,182,212,0.3)', text: '#0891B2', dot: '#06B6D4' },
  green: { bg: 'rgba(22,163,74,0.1)', border: 'rgba(22,163,74,0.3)', text: '#15803D', dot: '#22C55E' },
  red: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', text: '#DC2626', dot: '#EF4444' },
  gold: { bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.35)', text: '#854D0E', dot: '#EAB308' },
};

const IB_TYPE_LABELS: Record<IbType, string> = {
  standard: 'Standard IB',
  premium: 'Premium IB',
  white_label: 'White Label',
};

const SUGGESTED_TAGS = ['Hot Prospect', 'High Volume', 'Existing Client', 'Referred', 'Pending KYC', 'Negotiating', 'Priority', 'Follow Up'];

const COUNTRIES = ['India', 'United Arab Emirates', 'United Kingdom', 'United States', 'Singapore', 'Malaysia', 'Indonesia', 'Pakistan', 'Bangladesh', 'Nigeria', 'South Africa', 'Kenya', 'Australia', 'Canada', 'Germany', 'Other'];

const QUESTION_OPTIONS = {
  business_type: [
    'I am an active Forex IB',
    'I am an affiliate',
    'I manage a trading community/audience',
    'I am a Forex educator or signal provider',
    'I am interested in becoming an IB',
  ],
  network_size: ['0', '1–10', '11–50', '51–100', '101–250', '251–500', '500+'],
};

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

function formatDate(iso: string): string {
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
}

function computeLeadScore(lead: IbLead): number {
  let score = 0;
  if (lead.status === 'approved') score += 50;
  else if (lead.status === 'docs_received') score += 35;
  else if (lead.status === 'docs_requested') score += 20;
  else if (lead.status === 'contacted') score += 15;
  else if (lead.status === 'rejected') score -= 20;
  if (lead.fund_amount && lead.fund_amount > 0) score += Math.min(20, Math.floor(lead.fund_amount / 50000));
  if (lead.tags && lead.tags.length > 0) score += lead.tags.length * 3;
  if (lead.notes && lead.notes.trim().length > 0) score += 5;
  if (lead.broker_name) score += 5;
  if (lead.last_contacted_at) {
    const daysSince = (Date.now() - new Date(lead.last_contacted_at).getTime()) / 86400000;
    if (daysSince < 3) score += 10;
    else if (daysSince < 7) score += 5;
  }
  return Math.max(0, Math.min(100, score));
}

export default function IBLeadsPage({ session, onBack, onCall }: { session: Session; onBack: () => void; onCall?: (number: string) => void }) {
  const [leads, setLeads] = useState<IbLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | IbLeadStatus>('all');
  const [ibTypeFilter, setIbTypeFilter] = useState<'all' | IbType>('all');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [selectedLead, setSelectedLead] = useState<IbLead | null>(null);
  const [showAddLead, setShowAddLead] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showBulkStatus, setShowBulkStatus] = useState(false);
  const [bulkStatusValue, setBulkStatusValue] = useState<IbLeadStatus>('contacted');
  const [bulkStatusUpdating, setBulkStatusUpdating] = useState(false);
  const [bulkStatusResult, setBulkStatusResult] = useState<number | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilterPreset>('all');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');
  const [assigneeMap, setAssigneeMap] = useState<Record<string, string>>({});
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobileCustomizeOpen, setMobileCustomizeOpen] = useState(false);
  const [hiddenMobileStats, setHiddenMobileStats] = useState<IbMobileStatKey[]>(() => {
    try {
      const saved = localStorage.getItem(`ib-mobile-stats-${session.user.id}`);
      if (!saved) return [];
      const parsed: unknown = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((key): key is IbMobileStatKey => IB_MOBILE_STAT_OPTIONS.some((option) => option.key === key));
    } catch {
      return [];
    }
  });
  const [showImport, setShowImport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importProgress, setImportProgress] = useState<{ total: number; done: number; errors: string[]; finished?: boolean } | null>(null);

  useEffect(() => {
    localStorage.setItem(`ib-mobile-stats-${session.user.id}`, JSON.stringify(hiddenMobileStats));
  }, [hiddenMobileStats, session.user.id]);

  const toggleMobileStat = (key: IbMobileStatKey) => {
    setHiddenMobileStats((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  };

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: fetchError } = await supabase
      .from('ib_leads')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }
    const raw = (data || []) as IbLead[];
    setLeads(raw.map((l) => ({ ...l, lead_score: computeLeadScore(l) })));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('team_members')
        .select('id, email, full_name')
        .eq('status', 'active');
      if (data) {
        const map: Record<string, string> = {};
        for (const m of data as TeamMember[]) {
          map[m.id] = m.full_name || m.email;
        }
        setAssigneeMap(map);
      }
    })();
  }, []);

  const updateLeadInState = useCallback((id: string, updates: Partial<IbLead>) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)));
    setSelectedLead((prev) => (prev && prev.id === id ? { ...prev, ...updates } : prev));
  }, []);

  const updateLead = useCallback(async (id: string, updates: Partial<IbLead>) => {
    updateLeadInState(id, updates);
    const { error: updateError } = await supabase
      .from('ib_leads')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (updateError) {
      setError(updateError.message);
    }
  }, [updateLeadInState]);

  const deleteLead = useCallback(async (id: string) => {
    setLeads((prev) => prev.filter((l) => l.id !== id));
    setSelectedLead(null);
    const { error: deleteError } = await supabase
      .from('ib_leads')
      .update({ deleted_at: new Date().toISOString(), deleted_by: session.user.id })
      .eq('id', id);
    if (deleteError) {
      setError(deleteError.message);
      fetchLeads();
    }
  }, [fetchLeads, session.user.id]);

  const bulkDeleteLeads = useCallback(async (ids: string[]) => {
    setBulkDeleting(true);
    setLeads((prev) => prev.filter((l) => !ids.includes(l.id)));
    const BATCH = 100;
    let deleteError: string | null = null;
    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = ids.slice(i, i + BATCH);
      const { error } = await supabase
        .from('ib_leads')
        .update({ deleted_at: new Date().toISOString(), deleted_by: session.user.id })
        .in('id', batch);
      if (error) { deleteError = error.message; break; }
    }
    setBulkDeleting(false);
    setSelectedIds(new Set());
    setShowBulkDeleteConfirm(false);
    if (deleteError) {
      setError(deleteError);
      fetchLeads();
    }
  }, [fetchLeads, session.user.id]);

  const bulkUpdateStatus = useCallback(async (ids: string[], newStatus: IbLeadStatus) => {
    setBulkStatusUpdating(true);
    const BATCH = 100;
    let updateError: string | null = null;
    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = ids.slice(i, i + BATCH);
      const { error } = await supabase
        .from('ib_leads')
        .update({ status: newStatus, last_contacted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .in('id', batch);
      if (error) { updateError = error.message; break; }
    }
    setBulkStatusUpdating(false);
    if (updateError) {
      setError(updateError);
      return 0;
    }
    setLeads((prev) => prev.map((l) => ids.includes(l.id) ? { ...l, status: newStatus } : l));
    return ids.length;
  }, []);

  const addLead = useCallback(async (form: IbLeadForm): Promise<boolean> => {
    const { data, error: insertError } = await supabase
      .from('ib_leads')
      .insert({
        full_name: form.full_name,
        mobile_number: form.mobile_number,
        email: form.email,
        state: form.country_of_residence,
        country_of_residence: form.country_of_residence,
        business_type: form.business_type,
        broker_name: form.broker_name || null,
        network_size: form.network_size,
        status: form.status,
        notes: form.notes,
        tags: [],
      })
      .select()
      .single();
    if (insertError) {
      setError(insertError.message);
      return false;
    }
    if (data) {
      setLeads((prev) => [data as IbLead, ...prev]);
    }
    return true;
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

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

  const filteredLeads = useMemo(() => {
    let result = [...leads];
    if (dateRange.start || dateRange.end) {
      result = result.filter((l) => {
        const d = new Date(l.created_at);
        if (dateRange.start && d < dateRange.start) return false;
        if (dateRange.end && d > dateRange.end) return false;
        return true;
      });
    }
    if (ibTypeFilter !== 'all') {
      result = result.filter((l) => l.ib_type === ibTypeFilter);
    }
    if (statusFilter !== 'all') {
      result = result.filter((l) => l.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (l) =>
          l.full_name.toLowerCase().includes(q) ||
          l.email.toLowerCase().includes(q) ||
          l.mobile_number.toLowerCase().includes(q) ||
          l.state.toLowerCase().includes(q) ||
          (l.country_of_residence || '').toLowerCase().includes(q) ||
          (l.current_ib_affiliate || '').toLowerCase().includes(q) ||
          (l.business_type || '').toLowerCase().includes(q) ||
          (l.broker_name || '').toLowerCase().includes(q) ||
          (l.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    }
    result.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'created_at') {
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else {
        cmp = String(a[sortKey] || '').localeCompare(String(b[sortKey] || ''));
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [leads, search, statusFilter, ibTypeFilter, sortKey, sortDir, dateRange]);

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

  const selectAllLeads = () => setSelectedIds(new Set(filteredLeads.map((l) => l.id)));

  const stats = useMemo(() => {
    const total = leads.length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = leads.filter((l) => new Date(l.created_at) >= today).length;
    const approved = leads.filter((l) => l.status === 'approved').length;
    const docsReceived = leads.filter((l) => l.status === 'docs_received').length;
    const rejected = leads.filter((l) => l.status === 'rejected').length;
    const totalFunds = leads.reduce((sum, l) => sum + (l.fund_amount || 0), 0);
    return { total, todayCount, approved, docsReceived, rejected, totalFunds };
  }, [leads]);

  const pipelineStats = useMemo(() => {
    const map: Record<IbLeadStatus, number> = {
      new: 0, contacted: 0, docs_requested: 0, docs_received: 0, approved: 0, rejected: 0,
    };
    filteredLeads.forEach((l) => { map[l.status]++; });
    return map;
  }, [filteredLeads]);

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
    const headers = ['Full Name', 'Email Address', 'WhatsApp / Phone Number', 'Country of Residence', 'Business Type', 'Broker Name', 'Active Clients', 'Status', 'Tags', 'Notes', 'Submitted At'];
    const rows = filteredLeads.map((l) => [
      l.full_name,
      l.email,
      l.mobile_number,
      l.country_of_residence || l.state,
      l.business_type || '',
      l.broker_name || '',
      l.network_size || '',
      l.status.replace(/_/g, ' '),
      (l.tags || []).join('; '),
      l.notes || '',
      new Date(l.created_at).toLocaleString('en-IN'),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ib-leads-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setShowImport(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = String(ev.target?.result || '');
      parseAndImportCsv(text);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const parseAndImportCsv = async (text: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) { setError('CSV file is empty or has no data rows.'); return; }
    const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
    const rows = lines.slice(1).map((l) => parseCsvLine(l));
    const get = (row: string[], ...names: string[]) => {
      for (const n of names) {
        const idx = headers.indexOf(n.toLowerCase());
        if (idx >= 0 && row[idx]?.trim()) return row[idx].trim();
      }
      return '';
    };
    const validStatuses = IB_PIPELINE_STAGES.map((s) => s.key);
    const records: IbLeadForm[] = [];
    for (const row of rows) {
      const full_name = get(row, 'full name', 'name');
      const email = get(row, 'email address', 'email');
      const mobile_number = get(row, 'whatsapp / phone number', 'phone number', 'phone', 'mobile number', 'whatsapp');
      if (!full_name || !email || !mobile_number) continue;
      const rawStatus = get(row, 'status').replace(/\s+/g, '_').toLowerCase();
      records.push({
        full_name,
        email,
        mobile_number,
        country_of_residence: get(row, 'country of residence', 'country', 'state'),
        business_type: get(row, 'business type', 'business'),
        broker_name: get(row, 'broker name', 'broker'),
        network_size: get(row, 'active clients', 'network size'),
        status: validStatuses.includes(rawStatus as IbLeadStatus) ? (rawStatus as IbLeadStatus) : 'new',
        notes: get(row, 'notes'),
      });
    }
    if (records.length === 0) { setError('No valid rows found. CSV needs at least Full Name, Email, and Phone columns.'); return; }
    setImportProgress({ total: records.length, done: 0, errors: [] });
    let done = 0;
    const errors: string[] = [];
    const inserted: IbLead[] = [];
    for (const rec of records) {
      const { data, error: insErr } = await supabase.from('ib_leads').insert({
        full_name: rec.full_name, email: rec.email, mobile_number: rec.mobile_number,
        state: rec.country_of_residence, country_of_residence: rec.country_of_residence,
        business_type: rec.business_type, broker_name: rec.broker_name || null,
        network_size: rec.network_size,
        status: rec.status, notes: rec.notes, tags: [],
      }).select().single();
      if (insErr) { errors.push(`Row ${done + 1}: ${insErr.message}`); }
      else if (data) { inserted.push(data as IbLead); }
      done++;
      setImportProgress({ total: records.length, done, errors });
    }
    if (inserted.length > 0) {
      setLeads((prev) => [...inserted, ...prev]);
    }
    setImportProgress((prev) => prev ? { ...prev, finished: true } : prev);
  };

  const parseCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; }
          else { inQuotes = false; }
        } else { cur += ch; }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === ',') { result.push(cur); cur = ''; }
        else { cur += ch; }
      }
    }
    result.push(cur);
    return result;
  };

  return (
    <div className="ib-leads-page">
      {/* Header */}
      <div className="ib-leads-header ib-leads-header-desktop">
        <div className="ib-leads-header-left">
          <button className="ib-back-btn" onClick={onBack}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1>IB Leads</h1>
            <p>Manage clients applying for Introducing Broker partnerships</p>
          </div>
        </div>
        <div className="ib-leads-header-actions">
          <button className="ib-btn-add" onClick={() => setShowAddLead(true)}>
            <Plus size={16} /> Add IB Lead
          </button>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleImportFile} style={{ display: 'none' }} />
          <button className="ib-btn-import" onClick={() => fileInputRef.current?.click()}>
            <Upload size={16} /> Import
          </button>
          <div className="ib-view-toggle">
            <button className={viewMode === 'table' ? 'active' : ''} onClick={() => setViewMode('table')}>
              <TableIcon size={16} /> Table
            </button>
            <button className={viewMode === 'pipeline' ? 'active' : ''} onClick={() => setViewMode('pipeline')}>
              <LayoutGrid size={16} /> Pipeline
            </button>
          </div>
          <button className="ib-btn-export" onClick={handleExport} disabled={filteredLeads.length === 0}>
            <Download size={16} /> Export
          </button>
          <button className="ib-btn-refresh" onClick={fetchLeads} disabled={loading}>
            {loading ? <Loader2 size={16} className="crm-spin" /> : <ArrowUpRight size={16} />}
            Refresh
          </button>
        </div>
      </div>

      {/* Mobile header with actions */}
      <div className="ib-mobile-header-bar">
        <button className="ib-back-btn" onClick={onBack}>
          <ArrowLeft size={18} />
        </button>
        <span className="ib-mobile-header-title">IB Leads</span>
        <button className="ib-mobile-icon-btn" onClick={() => setShowAddLead(true)} aria-label="Add IB Lead">
          <Plus size={18} />
        </button>
      </div>

      {/* Mobile action bar */}
      <div className="ib-mobile-action-bar">
        <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleImportFile} style={{ display: 'none' }} />
        <button className="ib-mobile-action-btn" onClick={() => fileInputRef.current?.click()}>
          <Upload size={16} /> Import
        </button>
        <div className="ib-mobile-view-toggle">
          <button className={viewMode === 'table' ? 'active' : ''} onClick={() => setViewMode('table')}>
            <TableIcon size={15} />
          </button>
          <button className={viewMode === 'pipeline' ? 'active' : ''} onClick={() => setViewMode('pipeline')}>
            <LayoutGrid size={15} />
          </button>
        </div>
        <button className="ib-mobile-action-btn" onClick={handleExport} disabled={filteredLeads.length === 0}>
          <Download size={16} /> Export
        </button>
        <button className="ib-mobile-action-btn" onClick={fetchLeads} disabled={loading}>
          {loading ? <Loader2 size={16} className="crm-spin" /> : <ArrowUpRight size={16} />} Refresh
        </button>
      </div>

      <div className="ib-mobile-page-title">
        <div>
          <p>{stats.total} total applications</p>
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
            {IB_MOBILE_STAT_OPTIONS.map((option) => {
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
      <div className="ib-stats-grid">
        <div className={`ib-stat-card ib-stat-primary ${hiddenMobileStats.includes('total') ? 'ib-stat-mobile-hidden' : ''}`}>
          <div className="ib-stat-icon"><Users size={22} /></div>
          <div className="ib-stat-body">
            <span className="ib-stat-value">{stats.total}</span>
            <span className="ib-stat-label">Total IB Leads</span>
          </div>
        </div>
        <div className={`ib-stat-card ib-stat-success ${hiddenMobileStats.includes('approved') ? 'ib-stat-mobile-hidden' : ''}`}>
          <div className="ib-stat-icon"><Award size={22} /></div>
          <div className="ib-stat-body">
            <span className="ib-stat-value">{stats.approved}</span>
            <span className="ib-stat-label">Approved</span>
          </div>
        </div>
        <div className={`ib-stat-card ib-stat-info ${hiddenMobileStats.includes('docs') ? 'ib-stat-mobile-hidden' : ''}`}>
          <div className="ib-stat-icon"><FileText size={22} /></div>
          <div className="ib-stat-body">
            <span className="ib-stat-value">{stats.docsReceived}</span>
            <span className="ib-stat-label">Docs Received</span>
          </div>
        </div>
        <div className={`ib-stat-card ib-stat-warning ${hiddenMobileStats.includes('today') ? 'ib-stat-mobile-hidden' : ''}`}>
          <div className="ib-stat-icon"><Clock size={22} /></div>
          <div className="ib-stat-body">
            <span className="ib-stat-value">{stats.todayCount}</span>
            <span className="ib-stat-label">New Today</span>
          </div>
        </div>
        <div className={`ib-stat-card ib-stat-danger ${hiddenMobileStats.includes('rejected') ? 'ib-stat-mobile-hidden' : ''}`}>
          <div className="ib-stat-icon"><XCircle size={22} /></div>
          <div className="ib-stat-body">
            <span className="ib-stat-value">{stats.rejected}</span>
            <span className="ib-stat-label">Rejected</span>
          </div>
        </div>
        <div className={`ib-stat-card ib-stat-funds ${hiddenMobileStats.includes('volume') ? 'ib-stat-mobile-hidden' : ''}`}>
          <div className="ib-stat-icon"><TrendingUp size={22} /></div>
          <div className="ib-stat-body">
            <span className="ib-stat-value">${stats.totalFunds.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
            <span className="ib-stat-label">Expected Volume</span>
          </div>
        </div>
      </div>

      {error && <div className="crm-error-banner">{error}</div>}

      {loading ? (
        <div className="ib-table-card">
          <div className="crm-loading-state">
            <Loader2 size={32} className="crm-spin" />
            <p>Loading IB leads...</p>
          </div>
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="ib-table-card">
          <div className="crm-empty-state">
            <Users size={48} />
            <h3>No IB leads found</h3>
            <p>{leads.length === 0 ? 'No IB applications yet. Add your first IB lead to get started.' : 'No leads match your current filters. Try adjusting your search or status filter.'}</p>
          </div>
        </div>
      ) : viewMode === 'pipeline' ? (
        <div className="ib-pipeline-scroll">
          <IbPipelineView leads={filteredLeads} onLeadClick={setSelectedLead} onStatusChange={updateLead} formatDate={formatDate} assigneeMap={assigneeMap} />
        </div>
      ) : (
        <>
          <div className="ib-table-card">
            {/* Bulk Action Bar */}
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
                    <button onClick={selectAllLeads} disabled={bulkDeleting} className="crm-bulk-btn crm-bulk-btn-select">
                      <CheckCircle2 size={15} /> Select All ({filteredLeads.length})
                    </button>
                  )}
                  <button className="crm-bulk-clear-btn" onClick={clearSelection} disabled={bulkDeleting}>
                    Clear
                  </button>
                  <div className="crm-bulk-divider" />
                  <button
                    onClick={() => { setBulkStatusValue('contacted'); setBulkStatusResult(null); setShowBulkStatus(true); }}
                    className="crm-bulk-btn crm-bulk-btn-status"
                  >
                    <Filter size={15} /> Update Status
                  </button>
                  <button
                    className="crm-bulk-delete-btn"
                    onClick={() => setShowBulkDeleteConfirm(true)}
                    disabled={bulkDeleting}
                  >
                    <Trash2 size={15} /> Delete
                  </button>
                </div>
              </div>
            )}

            {/* Toolbar */}
            <div className="crm-table-toolbar">
              <div className="crm-search-wrap">
                <Search size={18} />
                <input type="text" placeholder="Search by name, email, phone, state, broker, or tags..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                />
              </div>
              <div className="crm-filter-wrap">
                <Filter size={16} />
                <select value={ibTypeFilter}
                  onChange={(e) => { setIbTypeFilter(e.target.value as typeof ibTypeFilter); setPage(0); }}
                >
                  <option value="all">All IB Types</option>
                  <option value="standard">Standard IB</option>
                  <option value="premium">Premium IB</option>
                  <option value="white_label">White Label</option>
                </select>
              </div>
              <div className="crm-filter-wrap">
                <select value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); setPage(0); }}
                >
                  <option value="all">All Statuses</option>
                  {IB_PIPELINE_STAGES.map((s) => (
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
            </div>

            {/* Table */}
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
                      <div className="crm-th-inner">Applicant
                        <span className={`crm-sort-arrow ${sortKey === 'full_name' ? `active ${sortDir}` : ''}`}>
                          {sortKey === 'full_name' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                        </span>
                      </div>
                    </th>
                    <th>Contact</th>
                    <th className="crm-th-sortable" onClick={() => handleSort('broker_name')}>
                      <div className="crm-th-inner">Broker
                        <span className={`crm-sort-arrow ${sortKey === 'broker_name' ? `active ${sortDir}` : ''}`}>
                          {sortKey === 'broker_name' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                        </span>
                      </div>
                    </th>
                    <th>IB Type</th>
                    <th>Status</th>
                    <th>Score</th>
                    <th>Assigned</th>
                    <th>Tags</th>
                    <th>Volume</th>
                    <th className="crm-th-sortable" onClick={() => handleSort('created_at')}>
                      <div className="crm-th-inner"><Calendar size={14} /> Submitted
                        <span className={`crm-sort-arrow ${sortKey === 'created_at' ? `active ${sortDir}` : ''}`}>
                          {sortKey === 'created_at' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                        </span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pagedLeads.map((lead) => {
                    const stage = IB_PIPELINE_STAGES.find((s) => s.key === lead.status)!;
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
                          {lead.broker_name ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', fontWeight: 600, color: '#1e40af', background: 'rgba(30,64,175,0.06)', padding: '3px 10px', borderRadius: '6px', border: '1px solid rgba(30,64,175,0.12)' }}>
                              <Building2 size={13} /> {lead.broker_name}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>—</span>
                          )}
                        </td>
                        <td>
                          <span className={`ib-type-badge ib-type-${lead.ib_type}`}>
                            {IB_TYPE_LABELS[lead.ib_type]}
                          </span>
                        </td>
                        <td>
                          <span className="crm-status-badge" style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}>
                            {stage.icon} {stage.label}
                          </span>
                        </td>
                        <td>
                          {(() => {
                            const score = lead.lead_score ?? 0;
                            const scoreColor = score >= 60 ? '#16a34a' : score >= 30 ? '#f59e0b' : '#94a3b8';
                            const scoreBg = score >= 60 ? 'rgba(22,163,74,0.1)' : score >= 30 ? 'rgba(245,158,11,0.1)' : 'rgba(148,163,184,0.1)';
                            const scoreLabel = score >= 60 ? 'Hot' : score >= 30 ? 'Warm' : 'Cold';
                            return (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 700, color: scoreColor, background: scoreBg, padding: '3px 8px', borderRadius: '6px', border: `1px solid ${scoreColor}20` }}>
                                <Zap size={11} /> {score} · {scoreLabel}
                              </span>
                            );
                          })()}
                        </td>
                        <td>
                          {lead.assigned_to ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', fontWeight: 600, color: '#0f766e', background: 'rgba(15,118,110,0.08)', padding: '3px 10px', borderRadius: '6px', border: '1px solid rgba(15,118,110,0.15)' }}>
                              <Shuffle size={12} /> {assigneeMap[lead.assigned_to] || 'Assigned'}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>—</span>
                          )}
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
                          {lead.fund_amount != null ? (
                            <span style={{ fontWeight: 700, color: '#16a34a' }}>
                              ${lead.fund_amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>—</span>
                          )}
                        </td>
                        <td><span className="crm-date-tag">{formatDate(lead.created_at)}</span></td>
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

          {/* Mobile Search + Filter */}
          <div className="crm-mobile-leads">
            {selectedIds.size > 0 && (
              <div className="crm-mobile-bulk-bar">
                <div className="crm-mobile-bulk-info">
                  <button className="crm-bulk-clear" onClick={clearSelection} aria-label="Clear selection">
                    <X size={16} />
                  </button>
                  <span>{selectedIds.size} selected</span>
                </div>
                <div className="crm-mobile-bulk-actions">
                  <button
                    onClick={() => { setBulkStatusValue('contacted'); setBulkStatusResult(null); setShowBulkStatus(true); }}
                    className="crm-mobile-bulk-btn"
                  >
                    <Filter size={15} /> Status
                  </button>
                  <button
                    className="crm-mobile-bulk-btn crm-mobile-bulk-delete"
                    onClick={() => setShowBulkDeleteConfirm(true)}
                    disabled={bulkDeleting}
                  >
                    <Trash2 size={15} /> Delete
                  </button>
                </div>
              </div>
            )}

            <div className="crm-mobile-search-bar">
              <div className="crm-mobile-search-wrap">
                <Search size={18} />
                <input type="text" placeholder="Search IB leads..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                />
              </div>
              <button className="crm-mobile-filter-btn" onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}>
                <Filter size={18} />
                <span>Filters</span>
                {(statusFilter !== 'all' || ibTypeFilter !== 'all' || dateFilter !== 'all') && <span className="crm-mobile-filter-dot" />}
              </button>
            </div>

            {mobileFiltersOpen && (
              <div className="crm-mobile-filter-panel">
                <div className="crm-mobile-filter-group">
                  <label>IB Type</label>
                  <select value={ibTypeFilter}
                    onChange={(e) => { setIbTypeFilter(e.target.value as typeof ibTypeFilter); setPage(0); }}
                  >
                    <option value="all">All Types</option>
                    <option value="standard">Standard IB</option>
                    <option value="premium">Premium IB</option>
                    <option value="white_label">White Label</option>
                  </select>
                </div>
                <div className="crm-mobile-filter-group">
                  <label>Status</label>
                  <select value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); setPage(0); }}
                  >
                    <option value="all">All Statuses</option>
                    {IB_PIPELINE_STAGES.map((s) => (
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
                <button className="crm-mobile-filter-clear" onClick={() => { setIbTypeFilter('all'); setStatusFilter('all'); setDateFilter('all'); setCustomDateStart(''); setCustomDateEnd(''); }}>
                  Clear All Filters
                </button>
              </div>
            )}

            {/* Mobile Cards */}
            <div className="crm-mobile-card-list">
              {pagedLeads.map((lead) => {
                const stage = IB_PIPELINE_STAGES.find((s) => s.key === lead.status)!;
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
                      {lead.broker_name && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 600, color: '#1e40af' }}>
                          <Building2 size={11} /> {lead.broker_name}
                        </span>
                      )}
                    </div>
                    <div className="crm-mobile-card-footer">
                      <span className={`ib-type-badge ib-type-${lead.ib_type}`}>
                        {IB_TYPE_LABELS[lead.ib_type]}
                      </span>
                      <span className="crm-mobile-card-score">
                        <Zap size={11} /> {lead.lead_score ?? 0}
                      </span>
                      {lead.fund_amount != null && (
                        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#16a34a' }}>
                          ${lead.fund_amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                      )}
                      <span className="crm-mobile-card-date">{formatDate(lead.created_at)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

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
        </>
      )}

      {selectedLead && (
        <IbLeadDetailDrawer
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={updateLead}
          onDelete={deleteLead}
          formatDate={formatDate}
          assigneeMap={assigneeMap}
          onCall={onCall}
        />
      )}

      {showAddLead && (
        <AddIbLeadModal
          onClose={() => setShowAddLead(false)}
          onAdd={addLead}
        />
      )}

      {showImport && (
        <ImportIbLeadsModal
          progress={importProgress}
          onClose={() => { setShowImport(false); setImportProgress(null); }}
          onDownloadTemplate={handleExport}
        />
      )}

      {showBulkDeleteConfirm && (
        <BulkDeleteConfirmModal
          count={selectedIds.size}
          deleting={bulkDeleting}
          onConfirm={() => bulkDeleteLeads(Array.from(selectedIds))}
          onCancel={() => setShowBulkDeleteConfirm(false)}
        />
      )}

      {showBulkStatus && (
        <BulkStatusModal
          count={selectedIds.size}
          currentStatus={bulkStatusValue}
          onStatusChange={setBulkStatusValue}
          updating={bulkStatusUpdating}
          result={bulkStatusResult}
          onConfirm={async () => {
            const count = await bulkUpdateStatus(Array.from(selectedIds), bulkStatusValue);
            setBulkStatusResult(count);
          }}
          onClose={() => { setShowBulkStatus(false); setBulkStatusResult(null); }}
        />
      )}
    </div>
  );
}

// ===================== Pipeline View =====================
function IbPipelineView({ leads, onLeadClick, onStatusChange, formatDate, assigneeMap }: {
  leads: IbLead[];
  onLeadClick: (lead: IbLead) => void;
  onStatusChange: (id: string, updates: Partial<IbLead>) => void;
  formatDate: (iso: string) => string;
  assigneeMap: Record<string, string>;
}) {
  return (
    <div className="ib-pipeline-board">
      {IB_PIPELINE_STAGES.map((stage) => {
        const stageLeads = leads.filter((l) => l.status === stage.key);
        const colors = STAGE_COLORS[stage.color];
        return (
          <div key={stage.key} className="ib-pipeline-column">
            <div className="ib-pipeline-col-header" style={{ borderBottomColor: colors.dot }}>
              <div className="ib-pipeline-col-title">
                <span className="ib-pipeline-dot" style={{ background: colors.dot }} />
                <span style={{ color: colors.text }}>{stage.label}</span>
              </div>
              <span className="ib-pipeline-count" style={{ background: colors.bg, color: colors.text }}>{stageLeads.length}</span>
            </div>
            <div className="ib-pipeline-col-body">
              {stageLeads.length === 0 ? (
                <div className="ib-pipeline-empty">No leads yet</div>
              ) : (
                stageLeads.map((lead) => {
                  const score = lead.lead_score ?? 0;
                  return (
                    <div key={lead.id} className="ib-pipeline-card" onClick={() => onLeadClick(lead)}>
                      <div className="ib-pipeline-card-top">
                        <div className="ib-pipeline-avatar">
                          {lead.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                        <div className="ib-pipeline-card-info">
                          <strong>{lead.full_name}</strong>
                          <span>{lead.email}</span>
                        </div>
                        {score >= 70 && <span className="ib-pipeline-hot" title="Hot lead"><Zap size={11} /></span>}
                      </div>
                      <div className="ib-pipeline-card-meta">
                        <span className="ib-pipeline-phone"><Phone size={11} /> {lead.mobile_number}</span>
                        <span className={`ib-type-badge ib-type-${lead.ib_type}`}>{IB_TYPE_LABELS[lead.ib_type]}</span>
                      </div>
                      {lead.broker_name && (
                        <div className="ib-pipeline-broker"><Building2 size={11} /> {lead.broker_name}</div>
                      )}
                      {(lead.tags || []).length > 0 && (
                        <div className="ib-pipeline-tags">
                          {lead.tags.slice(0, 3).map((t) => (
                            <span key={t} className="ib-pipeline-tag">{t}</span>
                          ))}
                        </div>
                      )}
                      <div className="ib-pipeline-card-bottom">
                        <span className="ib-pipeline-date">{formatDate(lead.created_at)}</span>
                        <select
                          value={lead.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => { e.stopPropagation(); onStatusChange(lead.id, { status: e.target.value as IbLeadStatus, last_contacted_at: new Date().toISOString() }); }}
                          className="ib-pipeline-select"
                          style={{ borderColor: colors.border, color: colors.text }}
                        >
                          {IB_PIPELINE_STAGES.map((s) => (
                            <option key={s.key} value={s.key}>{s.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ===================== Detail Drawer =====================
function IbLeadDetailDrawer({ lead, onClose, onUpdate, onDelete, formatDate, assigneeMap, onCall }: {
  lead: IbLead;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<IbLead>) => void;
  onDelete: (id: string) => void;
  formatDate: (iso: string) => string;
  assigneeMap: Record<string, string>;
  onCall?: (number: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [form, setForm] = useState({
    full_name: lead.full_name,
    mobile_number: lead.mobile_number,
    email: lead.email,
    state: lead.state,
    country_of_residence: lead.country_of_residence || lead.state,
    business_type: lead.business_type || '',
    broker_name: lead.broker_name || '',
    network_size: lead.network_size || '',
    ib_type: lead.ib_type,
    commission_level: lead.commission_level || '',
    status: lead.status,
    notes: lead.notes,
    fund_amount: lead.fund_amount?.toString() || '',
  });

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const stage = IB_PIPELINE_STAGES.find((s) => s.key === lead.status)!;
  const colors = STAGE_COLORS[stage.color];

  const addTag = () => {
    const tag = tagInput.trim();
    if (!tag) return;
    if (!(lead.tags || []).includes(tag)) {
      onUpdate(lead.id, { tags: [...(lead.tags || []), tag] });
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    onUpdate(lead.id, { tags: (lead.tags || []).filter((t) => t !== tag) });
  };

  const saveForm = () => {
    onUpdate(lead.id, {
      full_name: form.full_name,
      mobile_number: form.mobile_number,
      email: form.email,
      state: form.country_of_residence,
      country_of_residence: form.country_of_residence,
      business_type: form.business_type,
      network_size: form.network_size,
      broker_name: form.broker_name || null,
      ib_type: form.ib_type,
      commission_level: form.commission_level || null,
      status: form.status,
      notes: form.notes,
      fund_amount: form.fund_amount ? parseFloat(form.fund_amount) : null,
      last_contacted_at: form.status !== lead.status ? new Date().toISOString() : lead.last_contacted_at,
    });
    setEditing(false);
  };

  const initials = lead.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  const score = lead.lead_score ?? 0;
  const answers = [
    { q: 'Business type', a: lead.business_type },
    { q: 'Current broker', a: lead.broker_name },
    { q: 'Active clients with existing broker', a: lead.network_size },
  ].filter((x) => x.a);

  return (
    <>
      <div className="crm-drawer-overlay" onClick={onClose} />
      <div className="crm-drawer ib-lead-drawer">
        {/* ---------- Header ---------- */}
        <div className="ib-profile-header">
          <button className="ib-profile-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>

          <div className="ib-profile-identity">
            <div className="ib-profile-avatar">{initials}</div>
            <div className="ib-profile-name-block">
              <span className="ib-profile-kicker">IB APPLICATION</span>
              <h2>{lead.full_name}</h2>
              <p>{lead.business_type || 'Introducing Broker applicant'}</p>
            </div>
          </div>

          <div className="ib-profile-header-meta">
            <span className="ib-profile-status" style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}>
              {stage.icon} {stage.label}
            </span>
            <span className={`ib-type-badge ib-type-${lead.ib_type}`}>{IB_TYPE_LABELS[lead.ib_type]}</span>
            {lead.broker_name && <span className="ib-broker-pill"><Building2 size={12} /> {lead.broker_name}</span>}
            <span className="ib-profile-submitted">Applied {formatDate(lead.created_at)}</span>
          </div>

          <div className="ib-profile-actions">
            <button type="button" className="ib-profile-action ib-profile-action-primary" onClick={() => { window.location.href = `tel:${lead.mobile_number.replace(/[^+\d]/g, '')}`; }} style={{ cursor: 'pointer', font: 'inherit' }}><Phone size={15} /> Call</button>
            <a href={`mailto:${lead.email}`} className="ib-profile-action"><Mail size={15} /> Email</a>
            <a href={`https://wa.me/${lead.mobile_number.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="ib-profile-action"><MessageCircle size={15} /> WhatsApp</a>
          </div>

          <div className="ib-profile-score-row">
            <div className="ib-profile-score-copy">
              <span>Qualification</span>
              <strong>{score}<small>/100</small></strong>
            </div>
            <div className="ib-profile-score-track">
              <span style={{ width: `${score}%` }} />
            </div>
            <span className="ib-profile-score-label">{score >= 70 ? 'HOT LEAD' : score >= 40 ? 'WARM' : 'COLD'}</span>
          </div>
        </div>

        {/* ---------- Body ---------- */}
        <div className="crm-drawer-body ib-profile-body">
          {!editing ? (
            <>
              {/* Insight cards */}
              <div className="ib-insight-grid">
                <div className="ib-insight-card">
                  <div className="ib-insight-icon"><Users size={14} /></div>
                  <span className="ib-insight-label">Active Clients</span>
                  <strong>{lead.network_size || '—'}</strong>
                  <small>with existing broker</small>
                </div>
                <div className="ib-insight-card">
                  <div className="ib-insight-icon"><Building2 size={14} /></div>
                  <span className="ib-insight-label">Broker</span>
                  <strong>{lead.broker_name || '—'}</strong>
                  <small>current broker</small>
                </div>
                <div className="ib-insight-card">
                  <div className="ib-insight-icon"><Award size={14} /></div>
                  <span className="ib-insight-label">Business</span>
                  <strong>{lead.business_type || '—'}</strong>
                  <small>applicant type</small>
                </div>
              </div>

              {/* Contact cards */}
              <div className="crm-drawer-section">
                <div className="ib-section-heading">
                  <div><span className="ib-section-eyebrow">CONTACT</span><h3>Reach this applicant</h3></div>
                </div>
                <div className="ib-contact-grid">
                  <button type="button" className="ib-contact-card" onClick={() => { window.location.href = `tel:${lead.mobile_number.replace(/[^+\d]/g, '')}`; }} style={{ cursor: 'pointer', font: 'inherit' }}>
                    <div className="ib-contact-card-icon"><Phone size={16} /></div>
                    <span><small>Phone</small><strong>{lead.mobile_number}</strong></span>
                    <ArrowUpRight size={15} />
                  </button>
                  <a href={`mailto:${lead.email}`} className="ib-contact-card">
                    <div className="ib-contact-card-icon"><Mail size={16} /></div>
                    <span><small>Email</small><strong>{lead.email}</strong></span>
                    <ArrowUpRight size={15} />
                  </a>
                  <div className="ib-contact-card">
                    <div className="ib-contact-card-icon"><MapPin size={16} /></div>
                    <span><small>Country</small><strong>{lead.country_of_residence || lead.state || 'Not specified'}</strong></span>
                  </div>
                </div>
              </div>

              {/* Application answers */}
              <div className="crm-drawer-section">
                <div className="ib-section-heading">
                  <div><span className="ib-section-eyebrow">APPLICATION</span><h3>Questionnaire answers</h3></div>
                  <span className="ib-answer-count">{answers.length} answered</span>
                </div>
                <div className="ib-answer-list">
                  {answers.map((item) => (
                    <div key={item.q} className="ib-answer-row">
                      <span>{item.q}</span>
                      <strong>{item.a}</strong>
                    </div>
                  ))}
                  {answers.length === 0 && <div className="ib-answer-row"><span>No questions answered</span></div>}
                </div>
              </div>

              {/* CRM Details */}
              <div className="crm-drawer-section ib-internal-section">
                <div className="ib-section-heading">
                  <div><span className="ib-section-eyebrow">CRM DETAILS</span><h3>Internal information</h3></div>
                </div>
                <div className="crm-drawer-info-grid">
                  <div className="crm-drawer-info-item">
                    <Building2 size={16} />
                    <div>
                      <span className="crm-drawer-info-label">Broker</span>
                      <span className="crm-drawer-info-value">{lead.broker_name || 'Not specified'}</span>
                    </div>
                  </div>
                  <div className="crm-drawer-info-item">
                    <Award size={16} />
                    <div>
                      <span className="crm-drawer-info-label">IB Type</span>
                      <span className="crm-drawer-info-value">{IB_TYPE_LABELS[lead.ib_type]}</span>
                    </div>
                  </div>
                  <div className="crm-drawer-info-item">
                    <TrendingUp size={16} />
                    <div>
                      <span className="crm-drawer-info-label">Commission</span>
                      <span className="crm-drawer-info-value">{lead.commission_level || 'Not set'}</span>
                    </div>
                  </div>
                  {lead.fund_amount != null && (
                    <div className="crm-drawer-info-item">
                      <TrendingUp size={16} />
                      <div>
                        <span className="crm-drawer-info-label">Expected Volume</span>
                        <span className="crm-drawer-info-value" style={{ fontWeight: 700, color: '#16a34a' }}>${lead.fund_amount.toLocaleString('en-US')}</span>
                      </div>
                    </div>
                  )}
                  {lead.assigned_to && (
                    <div className="crm-drawer-info-item">
                      <Shuffle size={16} />
                      <div>
                        <span className="crm-drawer-info-label">Assigned To</span>
                        <span className="crm-drawer-info-value">{assigneeMap[lead.assigned_to] || 'Team Member'}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Tags */}
              <div className="crm-drawer-section">
                <div className="ib-section-heading">
                  <div><span className="ib-section-eyebrow">ORGANIZE</span><h3>Tags</h3></div>
                </div>
                <div className="crm-drawer-tags">
                  {(lead.tags || []).map((t) => (
                    <span key={t} className="crm-drawer-tag">
                      {t}
                      <button onClick={() => removeTag(t)} aria-label="Remove tag"><X size={12} /></button>
                    </span>
                  ))}
                  {(lead.tags || []).length === 0 && <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No tags yet</span>}
                </div>
                <div className="crm-drawer-tag-input-wrap">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                    placeholder="Add a tag and press Enter"
                  />
                  <button onClick={addTag} disabled={!tagInput.trim()}><Plus size={16} /> Add</button>
                </div>
                <div className="crm-drawer-suggested-tags">
                  {SUGGESTED_TAGS.filter((t) => !(lead.tags || []).includes(t)).slice(0, 5).map((t) => (
                    <button key={t} onClick={() => onUpdate(lead.id, { tags: [...(lead.tags || []), t] })} className="crm-suggested-tag-btn">
                      <Tag size={11} /> {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              {lead.notes ? (
                <div className="crm-drawer-section">
                  <div className="ib-section-heading">
                    <div><span className="ib-section-eyebrow">CONTEXT</span><h3>Notes</h3></div>
                  </div>
                  <p className="crm-drawer-notes">{lead.notes}</p>
                </div>
              ) : null}

              {/* Timeline */}
              <div className="crm-drawer-section">
                <div className="ib-section-heading">
                  <div><span className="ib-section-eyebrow">HISTORY</span><h3>Timeline</h3></div>
                </div>
                <div className="crm-drawer-timeline">
                  <div className="crm-timeline-item">
                    <span className="crm-timeline-dot" style={{ background: '#3B82F6' }} />
                    <div>
                      <span className="crm-timeline-label">IB application submitted</span>
                      <span className="crm-timeline-date">{formatDate(lead.created_at)}</span>
                    </div>
                  </div>
                  {lead.last_contacted_at && (
                    <div className="crm-timeline-item">
                      <span className="crm-timeline-dot" style={{ background: '#22C55E' }} />
                      <div>
                        <span className="crm-timeline-label">Last contacted</span>
                        <span className="crm-timeline-date">{formatDate(lead.last_contacted_at)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="crm-drawer-edit-form">
              <div className="crm-add-lead-grid">
                <label className="crm-add-lead-field">
                  <span>Full Name</span>
                  <input type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                </label>
                <label className="crm-add-lead-field">
                  <span>Mobile Number</span>
                  <input type="tel" value={form.mobile_number} onChange={(e) => setForm({ ...form, mobile_number: e.target.value })} />
                </label>
                <label className="crm-add-lead-field">
                  <span>Email</span>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </label>
                <label className="crm-add-lead-field">
                  <span>State</span>
                  <select value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}>
                    {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <label className="crm-add-lead-field">
                  <span>Broker Name</span>
                  <input type="text" value={form.broker_name} onChange={(e) => setForm({ ...form, broker_name: e.target.value })} placeholder="e.g. Exness, IC Markets" />
                </label>
                <label className="crm-add-lead-field">
                  <span>Business Type</span>
                  <select value={form.business_type} onChange={(e) => setForm({ ...form, business_type: e.target.value })}>
                    <option value="">Select...</option>
                    {QUESTION_OPTIONS.business_type.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label className="crm-add-lead-field">
                  <span>Active Clients</span>
                  <select value={form.network_size} onChange={(e) => setForm({ ...form, network_size: e.target.value })}>
                    <option value="">Select...</option>
                    {QUESTION_OPTIONS.network_size.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label className="crm-add-lead-field">
                  <span>IB Type</span>
                  <select value={form.ib_type} onChange={(e) => setForm({ ...form, ib_type: e.target.value as IbType })}>
                    <option value="standard">Standard IB</option>
                    <option value="premium">Premium IB</option>
                    <option value="white_label">White Label</option>
                  </select>
                </label>
                <label className="crm-add-lead-field">
                  <span>Commission Level</span>
                  <input type="text" value={form.commission_level} onChange={(e) => setForm({ ...form, commission_level: e.target.value })} placeholder="e.g. $10/lot, 20% revenue share" />
                </label>
                <label className="crm-add-lead-field">
                  <span>Status</span>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as IbLeadStatus })}>
                    {IB_PIPELINE_STAGES.map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </label>
                <label className="crm-add-lead-field">
                  <span>Expected Volume (USD)</span>
                  <input type="number" value={form.fund_amount} onChange={(e) => setForm({ ...form, fund_amount: e.target.value })} placeholder="e.g. 50000" />
                </label>
              </div>
              <label className="crm-add-lead-field crm-add-lead-notes">
                <span>Notes</span>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
              </label>
            </div>
          )}
        </div>

        {/* ---------- Footer ---------- */}
        <div className="crm-drawer-footer">
          {editing ? (
            <>
              <button className="crm-drawer-btn-cancel" onClick={() => setEditing(false)}>Cancel</button>
              <button className="crm-drawer-btn-save" onClick={saveForm}>
                <CheckCircle2 size={18} /> Save Changes
              </button>
            </>
          ) : (
            <>
              <button className="crm-drawer-btn-delete" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 size={18} /> Delete
              </button>
              <button className="crm-drawer-btn-edit" onClick={() => setEditing(true)}>
                <Pencil size={16} /> Edit Details
              </button>
            </>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <>
          <div className="crm-drawer-overlay" style={{ zIndex: 10002 }} onClick={() => setShowDeleteConfirm(false)} />
          <div className="crm-confirm-modal" style={{ zIndex: 10003 }}>
            <div className="crm-confirm-icon" style={{ background: 'rgba(239,68,68,0.1)', color: '#dc2626' }}>
              <AlertTriangle size={28} />
            </div>
            <h3>Delete this IB lead?</h3>
            <p>{lead.full_name} will be moved to trash. You can restore them later if needed.</p>
            <div className="crm-confirm-actions">
              <button className="crm-confirm-cancel" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button className="crm-confirm-delete" onClick={() => { setShowDeleteConfirm(false); onDelete(lead.id); }}>
                <Trash2 size={16} /> Delete
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ===================== Add IB Lead Modal =====================
function AddIbLeadModal({ onClose, onAdd }: {
  onClose: () => void;
  onAdd: (form: IbLeadForm) => Promise<boolean>;
}) {
  const [form, setForm] = useState<IbLeadForm>({
    full_name: '',
    email: '',
    mobile_number: '',
    country_of_residence: '',
    business_type: '',
    broker_name: '',
    network_size: '',
    status: 'new',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const canSubmit = Boolean(
    form.full_name && form.email && form.mobile_number && form.country_of_residence &&
    form.business_type && form.broker_name && form.network_size
  );

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
      setError('Failed to add IB lead. Please try again.');
    }
  };

  return (
    <>
      <div className="crm-drawer-overlay" onClick={onClose} />
      <div className="crm-add-lead-modal">
        <div className="crm-add-lead-header">
          <div className="crm-add-lead-title">
            <div className="crm-add-lead-icon">
              <Building2 size={22} />
            </div>
            <div>
              <h2>Add IB Lead</h2>
              <p>Add a new Introducing Broker applicant</p>
            </div>
          </div>
          <button className="crm-drawer-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="crm-add-lead-form">
          <div className="crm-add-lead-grid">
            <label className="crm-add-lead-field">
              <span>1. Full Name <em>*</em></span>
              <input type="text" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Enter full name" />
            </label>
            <label className="crm-add-lead-field">
              <span>2. Email Address <em>*</em></span>
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
            </label>
            <label className="crm-add-lead-field">
              <span>3. WhatsApp / Phone Number <em>*</em></span>
              <input type="tel" required value={form.mobile_number} onChange={(e) => setForm({ ...form, mobile_number: e.target.value })} placeholder="e.g. +91 88888 36633" inputMode="tel" />
            </label>
            <label className="crm-add-lead-field">
              <span>4. Country of Residence <em>*</em></span>
              <select required value={form.country_of_residence} onChange={(e) => setForm({ ...form, country_of_residence: e.target.value })}>
                <option value="" disabled>Select country</option>
                {COUNTRIES.map((country) => <option key={country} value={country}>{country}</option>)}
              </select>
            </label>
            <label className="crm-add-lead-field">
              <span>5. What best describes your current business? <em>*</em></span>
              <select required value={form.business_type} onChange={(e) => setForm({ ...form, business_type: e.target.value })}>
                <option value="" disabled>Select an answer</option>
                {QUESTION_OPTIONS.business_type.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="crm-add-lead-field">
              <span>6. Which broker are you currently working with? <em>*</em></span>
              <input type="text" required value={form.broker_name} onChange={(e) => setForm({ ...form, broker_name: e.target.value })} placeholder="Enter broker name, or N/A if none" />
            </label>
            <label className="crm-add-lead-field">
              <span>7. How many active clients do you currently have with your existing broker? <em>*</em></span>
              <select required value={form.network_size} onChange={(e) => setForm({ ...form, network_size: e.target.value })}>
                <option value="" disabled>Select a range</option>
                {QUESTION_OPTIONS.network_size.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          </div>

          <label className="crm-add-lead-field crm-add-lead-notes">
            <span>Internal Notes (optional)</span>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Add internal notes about this IB applicant..." rows={3} />
          </label>

          {error && <div className="crm-error">{error}</div>}

          <div className="crm-add-lead-actions">
            <button type="button" className="crm-add-lead-cancel" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="crm-add-lead-submit" disabled={!canSubmit || saving}>
              {saving ? <Loader2 size={18} className="crm-spin" /> : <Plus size={18} />}
              {saving ? 'Adding...' : 'Add IB Lead'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ===================== Bulk Delete Confirm =====================
function BulkDeleteConfirmModal({ count, deleting, onConfirm, onCancel }: {
  count: number;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <div className="crm-drawer-overlay" onClick={onCancel} />
      <div className="crm-confirm-modal">
        <div className="crm-confirm-icon" style={{ background: 'rgba(239,68,68,0.1)', color: '#dc2626' }}>
          <AlertTriangle size={28} />
        </div>
        <h3>Delete {count} IB lead{count !== 1 ? 's' : ''}?</h3>
        <p>These leads will be moved to trash. You can restore them later if needed.</p>
        <div className="crm-confirm-actions">
          <button className="crm-confirm-cancel" onClick={onCancel} disabled={deleting}>Cancel</button>
          <button className="crm-confirm-delete" onClick={onConfirm} disabled={deleting}>
            {deleting ? <Loader2 size={16} className="crm-spin" /> : <Trash2 size={16} />}
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </>
  );
}

// ===================== Bulk Status Modal =====================
function BulkStatusModal({ count, currentStatus, onStatusChange, updating, result, onConfirm, onClose }: {
  count: number;
  currentStatus: IbLeadStatus;
  onStatusChange: (status: IbLeadStatus) => void;
  updating: boolean;
  result: number | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="crm-drawer-overlay" onClick={onClose} />
      <div className="crm-confirm-modal">
        <div className="crm-confirm-icon" style={{ background: 'rgba(59,130,246,0.1)', color: '#2563eb' }}>
          <Filter size={28} />
        </div>
        <h3>Update Status for {count} lead{count !== 1 ? 's' : ''}</h3>
        <p>Select the new status for the selected IB leads.</p>
        <div style={{ margin: '16px 0' }}>
          <select
            value={currentStatus}
            onChange={(e) => onStatusChange(e.target.value as IbLeadStatus)}
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '0.9rem', fontWeight: 600 }}
          >
            {IB_PIPELINE_STAGES.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </div>
        {result !== null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(34,197,94,0.08)', borderRadius: '10px', color: '#16a34a', fontWeight: 600, fontSize: '0.85rem', marginBottom: '12px' }}>
            <CheckCircle2 size={16} /> Updated {result} leads successfully!
          </div>
        )}
        <div className="crm-confirm-actions">
          <button className="crm-confirm-cancel" onClick={onClose} disabled={updating}>Close</button>
          {result === null && (
            <button className="crm-confirm-delete" onClick={onConfirm} disabled={updating} style={{ background: '#2563eb' }}>
              {updating ? <Loader2 size={16} className="crm-spin" /> : <CheckCircle2 size={16} />}
              {updating ? 'Updating...' : 'Update Status'}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ===================== Import Leads Modal =====================
function ImportIbLeadsModal({ progress, onClose, onDownloadTemplate }: {
  progress: { total: number; done: number; errors: string[]; finished?: boolean } | null;
  onClose: () => void;
  onDownloadTemplate: () => void;
}) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const isWorking = progress && !progress.finished;
  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0;
  const successCount = progress ? progress.done - progress.errors.length : 0;

  return (
    <>
      <div className="crm-drawer-overlay" onClick={isWorking ? undefined : onClose} />
      <div className="crm-confirm-modal" style={{ maxWidth: 480, textAlign: 'left' }}>
        <div className="ib-import-header">
          <div className="ib-import-icon"><Upload size={22} /></div>
          <div>
            <h3>Import IB Leads</h3>
            <p>Upload a CSV file to bulk-import IB leads</p>
          </div>
          <button className="crm-drawer-close" onClick={onClose} disabled={!!isWorking} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {!progress && (
          <div className="ib-import-idle">
            <p>Your CSV should include these columns (name, email, and phone are required):</p>
            <div className="ib-import-columns">
              {['Full Name', 'Email Address', 'WhatsApp / Phone Number', 'Country of Residence', 'Business Type', 'Broker Name', 'Active Clients', 'Status', 'Notes'].map((c) => (
                <span key={c} className="ib-import-col-tag">{c}</span>
              ))}
            </div>
            <button className="ib-import-template-btn" onClick={onDownloadTemplate}>
              <Download size={15} /> Download CSV Template
            </button>
          </div>
        )}

        {progress && (
          <div className="ib-import-progress">
            <div className="ib-import-bar-track">
              <div className="ib-import-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="ib-import-stats">
              <span className="ib-import-stat">{progress.done} / {progress.total} processed</span>
              <span className="ib-import-stat ib-import-stat-success">{successCount} imported</span>
              {progress.errors.length > 0 && <span className="ib-import-stat ib-import-stat-error">{progress.errors.length} failed</span>}
            </div>
            {progress.finished && (
              <div className="ib-import-result">
                {successCount > 0 && (
                  <div className="ib-import-result-success">
                    <CheckCircle2 size={18} /> {successCount} lead{successCount !== 1 ? 's' : ''} imported successfully!
                  </div>
                )}
                {progress.errors.length > 0 && (
                  <div className="ib-import-result-errors">
                    <strong>{progress.errors.length} row{progress.errors.length !== 1 ? 's' : ''} failed:</strong>
                    <ul>{progress.errors.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}</ul>
                  </div>
                )}
                <button className="ib-import-done-btn" onClick={onClose}>Done</button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
