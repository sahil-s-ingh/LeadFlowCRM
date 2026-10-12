import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import {
  Loader2, AlertCircle, Search, TrendingUp, Users, DollarSign, Zap, Crown,
  Trash2, CheckSquare, Square, X, ShieldAlert, CreditCard, History,
  ArrowUpCircle, ArrowDownCircle, ShoppingCart, Lock, CheckCircle2, Shield,
} from 'lucide-react';

declare global {
  interface Window {
    Razorpay?: new (options: {
      key: string; amount: number; currency: string; name: string; description: string;
      order_id: string; prefill: { name: string; email: string; contact?: string };
      theme: { color: string }; modal?: { ondismiss: () => void };
      handler: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
    }) => { open: () => void };
  }
}

export type UsageRow = {
  user_id: string;
  email: string;
  plan_name: string | null;
  plan_slug: string | null;
  plan_id: string | null;
  sub_id: string | null;
  status: string;
  billing_cycle: string;
  monthly_price: number;
  currency: string;
  lead_count: number;
  lead_limit: number;
  team_count: number;
  team_seats: number;
  lead_usage_pct: number;
  team_usage_pct: number;
  last_sign_in_at: string | null;
};

type Plan = {
  id: string;
  name: string;
  slug: string;
  monthly_price: number;
  annual_price: number;
  currency: string;
  lead_limit: number;
  team_seats: number;
  is_active: boolean;
  is_featured: boolean;
  description: string | null;
};

type AuditLogEntry = {
  id: string;
  admin_email: string;
  action_type: string;
  target_email: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

export default function SuperAdminUsage({ session }: { session: Session }) {
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<UsageRow | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [planAssignTarget, setPlanAssignTarget] = useState<UsageRow | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [assigning, setAssigning] = useState(false);

  const [checkoutTarget, setCheckoutTarget] = useState<UsageRow | null>(null);
  const [checkoutPlanId, setCheckoutPlanId] = useState('');
  const [checkoutCycle, setCheckoutCycle] = useState<'monthly' | 'annual'>('monthly');
  const [checkoutStep, setCheckoutStep] = useState<'select' | 'processing' | 'success' | 'error'>('select');
  const [checkoutError, setCheckoutError] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const [auditLogOpen, setAuditLogOpen] = useState(false);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [accountsRes, subsRes, plansRes] = await Promise.all([
        supabase.rpc('get_super_admin_accounts'),
        supabase.from('account_subscriptions').select('id, user_id, plan_id, status, billing_cycle, current_period_end, trial_ends_at, subscription_plans(id, name, slug, monthly_price, annual_price, currency, lead_limit, team_seats)').order('created_at', { ascending: false }),
        supabase.from('subscription_plans').select('id, name, slug, monthly_price, annual_price, currency, lead_limit, team_seats, is_active, is_featured, description').eq('is_active', true).order('sort_order', { ascending: true }),
      ]);
      if (accountsRes.error) throw accountsRes.error;
      if (subsRes.error) throw subsRes.error;
      if (plansRes.error) throw plansRes.error;

      const subs = (subsRes.data || []) as Array<{
        id: string; user_id: string; plan_id: string | null; status: string; billing_cycle: string;
        current_period_end: string | null; trial_ends_at: string | null;
        subscription_plans: { id: string; name: string; slug: string; monthly_price: number; annual_price: number; currency: string; lead_limit: number; team_seats: number } | null;
      }>;
      const subMap = new Map<string, typeof subs[0]>();
      subs.forEach((s) => subMap.set(s.user_id, s));

      const usageRows: UsageRow[] = (accountsRes.data as Array<{ owner_id: string; email: string; team_count: number; lead_count: number; last_sign_in_at: string | null }>).map((acc) => {
        const sub = subMap.get(acc.owner_id);
        const plan = sub?.subscription_plans;
        const leadCount = acc.lead_count || 0;
        const leadLimit = plan?.lead_limit || 0;
        const teamCount = acc.team_count || 0;
        const teamSeats = plan?.team_seats || 0;
        const price = sub?.billing_cycle === 'annual' ? (plan?.annual_price || 0) : (plan?.monthly_price || 0);
        return {
          user_id: acc.owner_id, email: acc.email,
          plan_name: plan?.name || 'Free', plan_slug: plan?.slug || 'free',
          plan_id: sub?.plan_id || null, sub_id: sub?.id || null,
          status: sub?.status || 'trial', billing_cycle: sub?.billing_cycle || 'monthly',
          monthly_price: price, currency: plan?.currency || 'USD',
          lead_count: leadCount, lead_limit: leadLimit, team_count: teamCount, team_seats: teamSeats,
          lead_usage_pct: leadLimit > 0 ? Math.round((leadCount / leadLimit) * 100) : 0,
          team_usage_pct: teamSeats > 0 ? Math.round((teamCount / teamSeats) * 100) : 0,
          last_sign_in_at: acc.last_sign_in_at,
        };
      });
      setRows(usageRows);
      setPlans((plansRes.data as Plan[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load usage data');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(''), 5000); return () => clearTimeout(t); } }, [success]);

  const filtered = rows
    .filter((r) => { if (!search.trim()) return true; return r.email?.toLowerCase().includes(search.toLowerCase()); })
    .filter((r) => { if (planFilter === 'all') return true; if (planFilter === 'free') return r.plan_slug === 'free' || r.status === 'trial'; return r.plan_slug === planFilter; });

  const totalMRR = filtered.filter((r) => r.status === 'active').reduce((sum, r) => sum + r.monthly_price, 0);
  const paidAccounts = filtered.filter((r) => r.status === 'active' && r.monthly_price > 0).length;
  const nearLimit = filtered.filter((r) => r.lead_usage_pct >= 80).length;
  const planDistribution = filtered.reduce((acc, r) => { const key = r.plan_name || 'Free'; acc[key] = (acc[key] || 0) + 1; return acc; }, {} as Record<string, number>);

  const formatDate = (d?: string | null) => { if (!d) return '—'; try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return '—'; } };
  const currencySymbol = (c: string) => c === 'INR' ? '\u20B9' : c === 'EUR' ? '\u20AC' : c === 'GBP' ? '\u00A3' : '$';

  const toggleSelect = (userId: string) => setSelected((prev) => { const n = new Set(prev); if (n.has(userId)) n.delete(userId); else n.add(userId); return n; });
  const toggleSelectAll = () => { if (selected.size === filtered.length) setSelected(new Set()); else setSelected(new Set(filtered.map((r) => r.user_id))); };
  const selectedRows = filtered.filter((r) => selected.has(r.user_id));
  const isSelf = (userId: string) => userId === session.user.id;

  const getAdminSession = async () => {
    const { data: adminSession } = await supabase.auth.getSession();
    if (!adminSession.data.session) throw new Error('No active session');
    return adminSession.data.session;
  };

  // ── Delete ──
  const handleSingleDelete = async () => {
    if (!deleteTarget || deleteConfirmText !== 'DELETE') return;
    setDeleting(true); setError('');
    try {
      const s = await getAdminSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-manage-account`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.access_token}` },
        body: JSON.stringify({ action: 'delete_account', targetUserId: deleteTarget.user_id, targetEmail: deleteTarget.email }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed to delete account'); }
      setSuccess(`Account ${deleteTarget.email} has been deleted.`);
      setDeleteTarget(null); setDeleteConfirmText('');
      setSelected((prev) => { const n = new Set(prev); n.delete(deleteTarget.user_id); return n; });
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to delete account'); }
    setDeleting(false);
  };

  const handleBulkDelete = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    setDeleting(true); setError('');
    try {
      const s = await getAdminSession();
      const accounts = selectedRows.map((r) => ({ user_id: r.user_id, email: r.email }));
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-manage-account`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.access_token}` },
        body: JSON.stringify({ action: 'bulk_delete_accounts', accounts }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed to delete accounts'); }
      const data = await res.json();
      const succeeded = data.results?.filter((r: { success: boolean }) => r.success).length || 0;
      const failed = (data.results?.length || 0) - succeeded;
      setSuccess(`Deleted ${succeeded} account${succeeded !== 1 ? 's' : ''}.${failed > 0 ? ` ${failed} failed.` : ''}`);
      setBulkDeleteOpen(false); setDeleteConfirmText(''); setSelected(new Set());
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to delete accounts'); }
    setDeleting(false);
  };

  // ── Plan assignment (free, no payment) ──
  const openPlanAssign = (row: UsageRow) => {
    setPlanAssignTarget(row);
    setSelectedPlanId(row.plan_id || '');
    setSelectedBillingCycle(row.billing_cycle === 'annual' ? 'annual' : 'monthly');
  };

  const handleAssignPlan = async () => {
    if (!planAssignTarget || !selectedPlanId) return;
    setAssigning(true); setError('');
    try {
      const s = await getAdminSession();
      const plan = plans.find((p) => p.id === selectedPlanId);
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-manage-account`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.access_token}` },
        body: JSON.stringify({ action: 'assign_plan', targetUserId: planAssignTarget.user_id, targetEmail: planAssignTarget.email, planId: selectedPlanId, planName: plan?.name || '', billingCycle: selectedBillingCycle, status: 'active' }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed to assign plan'); }
      setSuccess(`Plan "${plan?.name || 'Unknown'}" assigned to ${planAssignTarget.email}.`);
      setPlanAssignTarget(null); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to assign plan'); }
    setAssigning(false);
  };

  const handleRemovePlan = async (row: UsageRow) => {
    if (!confirm(`Remove the plan from ${row.email}? They will be downgraded to Free.`)) return;
    setError('');
    try {
      const s = await getAdminSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-manage-account`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.access_token}` },
        body: JSON.stringify({ action: 'remove_plan', targetUserId: row.user_id, targetEmail: row.email }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed to remove plan'); }
      setSuccess(`Plan removed from ${row.email}.`); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to remove plan'); }
  };

  // ── Assisted checkout (Razorpay) ──
  const openCheckout = (row: UsageRow) => {
    setCheckoutTarget(row); setCheckoutPlanId(''); setCheckoutCycle('monthly');
    setCheckoutStep('select'); setCheckoutError(''); setCheckoutLoading(false);
  };

  const handleCheckoutPay = async () => {
    if (!checkoutTarget || !checkoutPlanId) return;
    setCheckoutLoading(true); setCheckoutError('');
    try {
      const s = await getAdminSession();
      const plan = plans.find((p) => p.id === checkoutPlanId);
      if (!plan) throw new Error('Plan not found');
      const price = checkoutCycle === 'annual' ? plan.annual_price : plan.monthly_price;

      const createRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/razorpay-create-order`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ planId: plan.id, planName: plan.name, amount: price, currency: plan.currency, billingCycle: checkoutCycle, customerName: checkoutTarget.email, customerEmail: checkoutTarget.email, customerPhone: '', customerState: '', targetUserId: checkoutTarget.user_id, adminEmail: s.user.email }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error || 'Failed to create order');

      setCheckoutStep('processing');

      await new Promise<void>((resolve, reject) => {
        if (window.Razorpay) { resolve(); return; }
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load payment gateway'));
        document.body.appendChild(script);
      });
      if (!window.Razorpay) throw new Error('Payment gateway failed to load');

      const rzp = new window.Razorpay({
        key: createData.keyId, amount: createData.amount, currency: createData.currency,
        name: 'LeadCentre CRM', description: `${plan.name} \u2014 ${checkoutCycle}`,
        order_id: createData.orderId,
        prefill: { name: checkoutTarget.email, email: checkoutTarget.email },
        theme: { color: '#0f766e' },
        modal: { ondismiss: () => { setCheckoutStep('select'); setCheckoutError('Payment cancelled. You can try again.'); } },
        handler: async (rzpResponse: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          try {
            const verifyRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/razorpay-verify-payment`, {
              method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
              body: JSON.stringify({ razorpayOrderId: rzpResponse.razorpay_order_id, razorpayPaymentId: rzpResponse.razorpay_payment_id, razorpaySignature: rzpResponse.razorpay_signature, dbOrderId: createData.dbOrderId, customerName: checkoutTarget.email, customerEmail: checkoutTarget.email, customerPhone: '', customerState: '', planName: plan.name, planId: plan.id, targetUserId: checkoutTarget.user_id, adminEmail: s.user.email, billingCycle: checkoutCycle }),
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.error || 'Payment verification failed');
            setCheckoutStep('success');
          } catch (err) {
            setCheckoutStep('error');
            setCheckoutError(err instanceof Error ? err.message : 'Payment verification failed');
          }
        },
      });
      rzp.open();
    } catch (err) { setCheckoutError(err instanceof Error ? err.message : 'Something went wrong'); }
    setCheckoutLoading(false);
  };

  // ── Audit log ──
  const loadAuditLog = async () => {
    setAuditLoading(true);
    try {
      const s = await getAdminSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-manage-account`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.access_token}` },
        body: JSON.stringify({ action: 'get_audit_log' }),
      });
      if (!res.ok) throw new Error('Failed to load audit log');
      const data = await res.json();
      setAuditLog((data.data as AuditLogEntry[]) || []);
    } catch { setAuditLog([]); }
    setAuditLoading(false);
  };

  const openAuditLog = () => { setAuditLogOpen(true); loadAuditLog(); };

  const formatAuditAction = (action: string) => {
    const map: Record<string, string> = { account_deleted: 'Account Deleted', accounts_bulk_deleted: 'Bulk Delete', plan_assigned: 'Plan Assigned', plan_removed: 'Plan Removed', admin_assisted_checkout: 'Assisted Checkout' };
    return map[action] || action.replace(/_/g, ' ');
  };

  const formatAuditDetails = (entry: AuditLogEntry) => {
    if (!entry.details) return '';
    const d = entry.details;
    if (entry.action_type === 'plan_assigned' || entry.action_type === 'admin_assisted_checkout') {
      return `${(d.plan_name as string) || 'Unknown'} \u00b7 ${(d.billing_cycle as string) || 'monthly'}`;
    }
    if (entry.action_type === 'accounts_bulk_deleted') {
      return `${d.succeeded} succeeded, ${d.failed} failed (of ${d.total_requested})`;
    }
    return '';
  };

  const allChecked = filtered.length > 0 && selected.size === filtered.length;
  const someChecked = selected.size > 0 && selected.size < filtered.length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '16px' }}>
        <button type="button" onClick={openAuditLog} style={topBtnStyle}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0f766e'; e.currentTarget.style.color = '#0f766e'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
        ><History size={14} /> Audit Log</button>
        <button type="button" onClick={load} disabled={loading} style={topBtnStyle}
          onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.borderColor = '#0f766e'; e.currentTarget.style.color = '#0f766e'; } }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
        >{loading ? <Loader2 size={14} className="crm-spin" /> : <TrendingUp size={14} />} Refresh</button>
      </div>

      {error && <Banner type="error" message={error} onClose={() => setError('')} />}
      {success && <Banner type="success" message={success} onClose={() => setSuccess('')} />}

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        <SummaryCard icon={<DollarSign size={20} />} label="Est. Monthly Revenue" value={`${currencySymbol('USD')}${totalMRR.toFixed(0)}`} sub="From active subscriptions" color="#16a34a" bg="rgba(22,163,74,0.08)" />
        <SummaryCard icon={<Crown size={20} />} label="Paid Accounts" value={paidAccounts} sub={`${filtered.length - paidAccounts} on free/trial`} color="#d97706" bg="rgba(217,119,6,0.08)" />
        <SummaryCard icon={<Zap size={20} />} label="Near Limit (80%+)" value={nearLimit} sub="Consider upselling" color="#dc2626" bg="rgba(220,38,38,0.08)" />
        <SummaryCard icon={<Users size={20} />} label="Total Accounts" value={filtered.length} sub="All on platform" color="#0f766e" bg="rgba(15,118,110,0.08)" />
      </div>

      {/* Plan distribution */}
      {Object.keys(planDistribution).length > 0 && (
        <div style={{ background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border-subtle)', padding: '18px 20px', marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>Plan Distribution</h3>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {Object.entries(planDistribution).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
              <span key={name} style={{ padding: '6px 14px', borderRadius: '10px', background: name === 'Free' ? 'rgba(148,163,184,0.1)' : 'rgba(15,118,110,0.08)', border: `1px solid ${name === 'Free' ? 'rgba(148,163,184,0.2)' : 'rgba(15,118,110,0.2)'}`, fontSize: '0.8rem', fontWeight: 600, color: name === 'Free' ? '#64748b' : '#0f766e' }}>
                {name}: <strong style={{ fontSize: '0.85rem' }}>{count}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '12px', padding: '12px 18px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 600, color: '#dc2626' }}>
            <CheckSquare size={16} /> {selected.size} account{selected.size !== 1 ? 's' : ''} selected
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={() => setSelected(new Set())} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>Clear Selection</button>
            <button type="button" onClick={() => { setBulkDeleteOpen(true); setDeleteConfirmText(''); }} style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid rgba(220,38,38,0.3)', background: 'rgba(220,38,38,0.1)', color: '#dc2626', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Trash2 size={14} /> Delete Selected ({selected.size})
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dark)' }} />
          <input type="text" placeholder="Search by email..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ padding: '9px 12px 9px 34px', border: '1px solid var(--border-subtle)', borderRadius: '8px', fontSize: '0.85rem', outline: 'none', width: '260px' }} />
        </div>
        <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} style={{ padding: '9px 12px', border: '1px solid var(--border-subtle)', borderRadius: '8px', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}>
          <option value="all">All Plans</option>
          <option value="free">Free / Trial</option>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px' }}><Loader2 size={28} className="crm-spin" style={{ color: '#0f766e' }} /></div>
      ) : filtered.length === 0 ? (
        <div style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-subtle)', padding: '48px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-dark)', fontSize: '0.88rem' }}>No accounts match your filters.</p>
        </div>
      ) : (
        <div style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-light)' }}>
                  <th style={{ ...th, width: '40px', textAlign: 'center' }}>
                    <button type="button" onClick={toggleSelectAll} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: allChecked || someChecked ? '#0f766e' : 'var(--text-dark)' }}>
                      {allChecked ? <CheckSquare size={16} /> : someChecked ? <CheckSquare size={16} /> : <Square size={16} />}
                    </button>
                  </th>
                  <th style={th}>Account</th>
                  <th style={th}>Plan</th>
                  <th style={th}>Status</th>
                  <th style={th}>Leads Used</th>
                  <th style={th}>Team Used</th>
                  <th style={th}>Revenue</th>
                  <th style={th}>Last Active</th>
                  <th style={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.user_id} style={{ borderBottom: '1px solid var(--border-subtle)', background: selected.has(r.user_id) ? 'rgba(15,118,110,0.03)' : 'transparent' }}>
                    <td style={{ ...td, textAlign: 'center' }}>
                      <button type="button" onClick={() => toggleSelect(r.user_id)} disabled={isSelf(r.user_id)} style={{ background: 'none', border: 'none', cursor: isSelf(r.user_id) ? 'not-allowed' : 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: selected.has(r.user_id) ? '#0f766e' : 'var(--text-dark)', opacity: isSelf(r.user_id) ? 0.3 : 1 }}>
                        {selected.has(r.user_id) ? <CheckSquare size={16} /> : <Square size={16} />}
                      </button>
                    </td>
                    <td style={td}>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.83rem' }}>
                        {r.email}{isSelf(r.user_id) && <span style={{ marginLeft: '6px', fontSize: '0.65rem', color: '#d97706', fontWeight: 700, textTransform: 'uppercase' }}>(You)</span>}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dark)', marginTop: '2px' }}>{r.user_id.slice(0, 8)}...</div>
                    </td>
                    <td style={td}>
                      <span style={{ padding: '3px 10px', borderRadius: '6px', background: r.plan_slug === 'free' ? 'rgba(148,163,184,0.1)' : 'rgba(15,118,110,0.08)', color: r.plan_slug === 'free' ? '#64748b' : '#0f766e', fontSize: '0.75rem', fontWeight: 700 }}>{r.plan_name || 'Free'}</span>
                    </td>
                    <td style={td}>
                      <span style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, background: r.status === 'active' ? 'rgba(22,163,74,0.1)' : r.status === 'trial' ? 'rgba(234,179,8,0.1)' : r.status === 'canceled' ? 'rgba(220,38,38,0.1)' : 'rgba(148,163,184,0.1)', color: r.status === 'active' ? '#16a34a' : r.status === 'trial' ? '#ca8a04' : r.status === 'canceled' ? '#dc2626' : '#64748b' }}>{r.status}</span>
                    </td>
                    <td style={td}><UsageBar used={r.lead_count} limit={r.lead_limit} pct={r.lead_usage_pct} /></td>
                    <td style={td}><UsageBar used={r.team_count} limit={r.team_seats} pct={r.team_usage_pct} /></td>
                    <td style={{ ...td, fontWeight: 700, color: r.monthly_price > 0 ? '#16a34a' : 'var(--text-dark)', fontSize: '0.85rem' }}>
                      {currencySymbol(r.currency)}{r.monthly_price.toFixed(0)}
                      {r.billing_cycle === 'annual' && r.monthly_price > 0 && <span style={{ fontSize: '0.68rem', color: 'var(--text-dark)', fontWeight: 400 }}>/mo*</span>}
                    </td>
                    <td style={{ ...td, fontSize: '0.78rem' }}>{formatDate(r.last_sign_in_at)}</td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        <button type="button" onClick={() => openCheckout(r)} title="Buy plan via Razorpay" style={{ ...actionBtn, color: '#2563eb', borderColor: 'rgba(37,99,235,0.2)' }}><ShoppingCart size={13} /></button>
                        <button type="button" onClick={() => openPlanAssign(r)} title="Assign plan (no payment)" style={{ ...actionBtn, color: '#0f766e', borderColor: 'rgba(15,118,110,0.2)' }}><CreditCard size={13} /></button>
                        {r.plan_slug !== 'free' && r.sub_id && (
                          <button type="button" onClick={() => handleRemovePlan(r)} title="Remove plan" style={{ ...actionBtn, color: '#d97706', borderColor: 'rgba(217,119,6,0.2)' }}><ArrowDownCircle size={13} /></button>
                        )}
                        <button type="button" onClick={() => { setDeleteTarget(r); setDeleteConfirmText(''); }} disabled={isSelf(r.user_id)} title={isSelf(r.user_id) ? 'Cannot delete your own account' : 'Delete account'} style={{ ...actionBtn, color: isSelf(r.user_id) ? 'var(--text-dark)' : '#dc2626', borderColor: isSelf(r.user_id) ? 'var(--border-subtle)' : 'rgba(220,38,38,0.2)', cursor: isSelf(r.user_id) ? 'not-allowed' : 'pointer', opacity: isSelf(r.user_id) ? 0.4 : 1 }}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p style={{ marginTop: '12px', fontSize: '0.72rem', color: 'var(--text-dark)', textAlign: 'center' }}>* Annual plans show monthly equivalent. Revenue is estimated from active subscriptions.</p>

      {/* Single Delete Modal */}
      {deleteTarget && <DeleteModal title="Delete Account" message={<>You are about to permanently delete <strong>{deleteTarget.email}</strong> and all associated data. This action cannot be undone.</>} confirmText={deleteConfirmText} setConfirmText={setDeleteConfirmText} onCancel={() => { setDeleteTarget(null); setDeleteConfirmText(''); }} onConfirm={handleSingleDelete} deleting={deleting} />}

      {/* Bulk Delete Modal */}
      {bulkDeleteOpen && (
        <DeleteModal title={`Delete ${selectedRows.length} Accounts`} message={<><p style={{ margin: '0 0 10px' }}>You are about to permanently delete <strong>{selectedRows.length} account{selectedRows.length !== 1 ? 's' : ''}</strong> and all their data.</p><div style={{ maxHeight: '120px', overflowY: 'auto', background: 'var(--bg-light)', borderRadius: '8px', padding: '8px 12px', fontSize: '0.78rem', color: 'var(--text-dark)' }}>{selectedRows.map((r) => <div key={r.user_id} style={{ padding: '2px 0' }}>&bull; {r.email}</div>)}</div></>} confirmText={deleteConfirmText} setConfirmText={setDeleteConfirmText} onCancel={() => { setBulkDeleteOpen(false); setDeleteConfirmText(''); }} onConfirm={handleBulkDelete} deleting={deleting} />
      )}

      {/* Assisted Checkout Modal */}
      {checkoutTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.5)' }} onClick={() => checkoutStep !== 'processing' && setCheckoutTarget(null)} />
          <div style={{ position: 'relative', background: 'var(--bg-card)', borderRadius: '16px', padding: '28px', maxWidth: '460px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px -10px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(37,99,235,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ShoppingCart size={18} style={{ color: '#2563eb' }} /></div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>{checkoutStep === 'success' ? 'Payment Complete' : checkoutStep === 'error' ? 'Payment Issue' : checkoutStep === 'processing' ? 'Processing...' : 'Assisted Checkout'}</h3>
                  <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-dark)' }}>{checkoutTarget.email}</p>
                </div>
              </div>
              {checkoutStep !== 'processing' && <button type="button" onClick={() => setCheckoutTarget(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dark)', padding: '4px' }}><X size={20} /></button>}
            </div>

            {checkoutStep === 'success' ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#f0fdf4', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CheckCircle2 size={36} style={{ color: '#16a34a' }} /></div>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 8px' }}>Subscription Activated!</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-dark)', maxWidth: '320px', margin: '0 auto 20px', lineHeight: 1.5 }}>Payment was successful and the plan is now active for {checkoutTarget.email}.</p>
                <button type="button" onClick={() => { setCheckoutTarget(null); load(); }} style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', background: '#0f766e', color: '#fff', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>Done</button>
              </div>
            ) : checkoutStep === 'error' ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#fef2f2', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AlertCircle size={36} style={{ color: '#dc2626' }} /></div>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 8px' }}>Payment Could Not Be Completed</h4>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-dark)', maxWidth: '320px', margin: '0 auto 20px', lineHeight: 1.5 }}>{checkoutError || 'Something went wrong with the payment.'}</p>
                <button type="button" onClick={() => { setCheckoutStep('select'); setCheckoutError(''); }} style={{ padding: '10px 24px', borderRadius: '10px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>Try Again</button>
              </div>
            ) : checkoutStep === 'processing' ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Loader2 size={36} className="crm-spin" style={{ color: '#0f766e', margin: '0 auto 12px' }} />
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 4px' }}>Processing Payment...</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-dark)' }}>Please don't close this window.</p>
              </div>
            ) : (
              <>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Choose Plan</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                  {plans.map((plan) => (
                    <button key={plan.id} type="button" onClick={() => setCheckoutPlanId(plan.id)} style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', border: checkoutPlanId === plan.id ? '2px solid #0f766e' : '1px solid var(--border-subtle)', background: checkoutPlanId === plan.id ? 'rgba(15,118,110,0.04)' : 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <strong style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)' }}>{plan.name}</strong>
                          {plan.is_featured && <span style={{ background: 'rgba(15,118,110,0.1)', color: '#0f766e', fontSize: '0.6rem', fontWeight: 900, padding: '2px 8px', borderRadius: '999px', textTransform: 'uppercase' }}>Popular</span>}
                        </div>
                        {plan.description && <span style={{ fontSize: '0.74rem', color: 'var(--text-dark)', display: 'block', marginTop: '2px' }}>{plan.description}</span>}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '1rem', fontWeight: 900, color: checkoutPlanId === plan.id ? '#0f766e' : 'var(--text-main)' }}>{currencySymbol(plan.currency)}{(checkoutCycle === 'annual' ? plan.annual_price : plan.monthly_price).toLocaleString()}</div>
                        <span style={{ fontSize: '0.66rem', color: 'var(--text-dark)' }}>/mo</span>
                      </div>
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                  <div style={{ display: 'inline-flex', background: 'var(--bg-light)', border: '1px solid var(--border-subtle)', borderRadius: '999px', padding: 3 }}>
                    {(['monthly', 'annual'] as const).map((cycle) => (
                      <button key={cycle} type="button" onClick={() => setCheckoutCycle(cycle)} style={{ padding: '6px 16px', borderRadius: '999px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.76rem', transition: 'all 0.2s', background: checkoutCycle === cycle ? '#0f766e' : 'transparent', color: checkoutCycle === cycle ? '#fff' : 'var(--text-dark)', textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        {cycle}{cycle === 'annual' && <span style={{ background: 'rgba(22,163,74,0.2)', color: '#16a34a', fontSize: '0.58rem', fontWeight: 900, padding: '1px 5px', borderRadius: '999px' }}>SAVE</span>}
                      </button>
                    ))}
                  </div>
                </div>

                {checkoutError && <div style={{ padding: '10px 14px', borderRadius: '10px', background: '#fef2f2', border: '1px solid #fecaca', fontSize: '0.82rem', color: '#dc2626', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><AlertCircle size={16} /> {checkoutError}</div>}

                {(() => {
                  const plan = plans.find((p) => p.id === checkoutPlanId);
                  const price = plan ? (checkoutCycle === 'annual' ? plan.annual_price : plan.monthly_price) : 0;
                  const sym = plan ? currencySymbol(plan.currency) : '$';
                  return (
                    <button type="button" onClick={handleCheckoutPay} disabled={!checkoutPlanId || checkoutLoading} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', background: checkoutPlanId && !checkoutLoading ? '#0f766e' : 'var(--bg-light)', color: checkoutPlanId && !checkoutLoading ? '#fff' : 'var(--text-dark)', fontSize: '0.92rem', fontWeight: 800, cursor: checkoutPlanId && !checkoutLoading ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}>
                      {checkoutLoading ? <><Loader2 size={18} className="crm-spin" /> Preparing Checkout...</> : <><Lock size={16} /> Pay {sym}{price.toLocaleString()} & Activate Plan</>}
                    </button>
                  );
                })()}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '10px' }}>
                  <Shield size={13} style={{ color: 'var(--text-dark)' }} />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-dark)' }}>Secured by Razorpay \u00b7 Payment is logged to audit trail</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Plan Assignment Modal */}
      {planAssignTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.5)' }} onClick={() => setPlanAssignTarget(null)} />
          <div style={{ position: 'relative', background: 'var(--bg-card)', borderRadius: '16px', padding: '28px', maxWidth: '480px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px -10px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>Manage Subscription</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-dark)' }}>{planAssignTarget.email}</p>
              </div>
              <button type="button" onClick={() => setPlanAssignTarget(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dark)', padding: '4px' }}><X size={20} /></button>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-dark)', marginBottom: '6px' }}>Select Plan</label>
              <select value={selectedPlanId} onChange={(e) => setSelectedPlanId(e.target.value)} style={modalInputStyle}>
                <option value="">\u2014 Choose a plan \u2014</option>
                {plans.map((p) => <option key={p.id} value={p.id}>{p.name} \u2014 {currencySymbol(p.currency)}{p.monthly_price}/mo \u00b7 {p.lead_limit} leads \u00b7 {p.team_seats} seats</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-dark)', marginBottom: '6px' }}>Billing Cycle</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['monthly', 'annual'] as const).map((cycle) => {
                  const plan = plans.find((p) => p.id === selectedPlanId);
                  const price = cycle === 'annual' ? plan?.annual_price : plan?.monthly_price;
                  return (
                    <button key={cycle} type="button" onClick={() => setSelectedBillingCycle(cycle)} style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', border: `2px solid ${selectedBillingCycle === cycle ? '#0f766e' : 'var(--border-subtle)'}`, background: selectedBillingCycle === cycle ? 'rgba(15,118,110,0.06)' : 'var(--bg-card)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: selectedBillingCycle === cycle ? '#0f766e' : 'var(--text-main)', textTransform: 'capitalize' }}>{cycle}</div>
                      {price !== undefined && <div style={{ fontSize: '0.72rem', color: 'var(--text-dark)', marginTop: '2px' }}>{plan ? currencySymbol(plan.currency) : '$'}{price}{cycle === 'annual' ? '/yr' : '/mo'}</div>}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ padding: '12px 14px', background: 'rgba(15,118,110,0.06)', borderRadius: '10px', marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <ShieldAlert size={16} style={{ color: '#0f766e', flexShrink: 0, marginTop: 1 }} />
              <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>This bypasses checkout and assigns the plan directly. Use for offline payments, manual upgrades, or custom deals. The change is logged to the audit trail.</p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={handleAssignPlan} disabled={!selectedPlanId || assigning} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: !selectedPlanId ? 'var(--bg-light)' : '#0f766e', color: !selectedPlanId ? 'var(--text-dark)' : '#fff', fontSize: '0.85rem', fontWeight: 700, cursor: !selectedPlanId || assigning ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                {assigning ? <Loader2 size={16} className="crm-spin" /> : <ArrowUpCircle size={16} />} Assign Plan
              </button>
              <button type="button" onClick={() => setPlanAssignTarget(null)} style={{ padding: '10px 18px', borderRadius: '10px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-dark)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Log Modal */}
      {auditLogOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.5)' }} onClick={() => setAuditLogOpen(false)} />
          <div style={{ position: 'relative', background: 'var(--bg-card)', borderRadius: '16px', padding: '28px', maxWidth: '640px', width: '100%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px -10px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}><History size={18} style={{ color: '#0f766e' }} /> Admin Audit Log</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-dark)' }}>Last 100 admin actions</p>
              </div>
              <button type="button" onClick={() => setAuditLogOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dark)', padding: '4px' }}><X size={20} /></button>
            </div>
            {auditLoading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}><Loader2 size={24} className="crm-spin" style={{ color: '#0f766e' }} /></div>
            ) : auditLog.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dark)', fontSize: '0.85rem' }}>No admin actions logged yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {auditLog.map((entry) => {
                  const isDelete = entry.action_type.includes('deleted');
                  const isPlan = entry.action_type.includes('plan') || entry.action_type.includes('checkout');
                  return (
                    <div key={entry.id} style={{ padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border-subtle)', background: 'var(--bg-light)', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: isDelete ? 'rgba(220,38,38,0.1)' : isPlan ? 'rgba(15,118,110,0.1)' : 'rgba(148,163,184,0.1)' }}>
                        {isDelete ? <Trash2 size={15} style={{ color: '#dc2626' }} /> : isPlan ? <CreditCard size={15} style={{ color: '#0f766e' }} /> : <History size={15} style={{ color: 'var(--text-dark)' }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>{formatAuditAction(entry.action_type)}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-dark)' }}>{formatDate(entry.created_at)}</span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                          <strong style={{ color: 'var(--text-main)' }}>{entry.admin_email}</strong> &rarr; {entry.target_email || 'N/A'}
                          {formatAuditDetails(entry) && <span style={{ color: 'var(--text-dark)' }}> \u00b7 {formatAuditDetails(entry)}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = { textAlign: 'left', padding: '12px 14px', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dark)', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '13px 14px', fontSize: '0.83rem', color: 'var(--text-muted)' };

const topBtnStyle: React.CSSProperties = {
  padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)',
  background: 'var(--bg-card)', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600,
  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', transition: 'all 0.15s',
};

const actionBtn: React.CSSProperties = {
  padding: '6px 8px', borderRadius: '7px', border: '1px solid var(--border-subtle)',
  background: 'var(--bg-card)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.15s',
};

const modalInputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1px solid var(--border-subtle)', borderRadius: '10px',
  fontSize: '0.85rem', outline: 'none', color: 'var(--text-main)',
};

function SummaryCard({ icon, label, value, sub, color, bg }: { icon: React.ReactNode; label: string; value: string | number; sub: string; color: string; bg: string }) {
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border-subtle)', padding: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <div style={{ width: '38px', height: '38px', borderRadius: '9px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>{icon}</div>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dark)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      </div>
      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1, marginBottom: '4px' }}>{value}</div>
      <div style={{ fontSize: '0.74rem', color: 'var(--text-dark)' }}>{sub}</div>
    </div>
  );
}

function UsageBar({ used, limit, pct }: { used: number; limit: number; pct: number }) {
  const color = pct >= 100 ? '#dc2626' : pct >= 80 ? '#d97706' : pct >= 50 ? '#0f766e' : '#16a34a';
  const displayLimit = limit > 0 ? limit.toLocaleString() : '\u221E';
  return (
    <div style={{ minWidth: '120px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
        <span>{used.toLocaleString()} / {displayLimit}</span>
        <span style={{ color }}>{pct}%</span>
      </div>
      <div style={{ height: '6px', borderRadius: '3px', background: 'var(--bg-light)', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: '3px', background: color, width: `${Math.min(pct, 100)}%`, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

function Banner({ type, message, onClose }: { type: 'error' | 'success'; message: string; onClose: () => void }) {
  const isErr = type === 'error';
  return (
    <div style={{ padding: '14px 16px', borderRadius: '12px', fontSize: '0.85rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', background: isErr ? 'var(--bg-card)' : '#f0fdf4', border: `1px solid ${isErr ? '#fecaca' : '#bbf7d0'}`, color: isErr ? '#dc2626' : '#16a34a' }}>
      {isErr ? <AlertCircle size={18} /> : <CheckSquare size={18} />} {message}
      <button type="button" onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.6 }}><X size={16} /></button>
    </div>
  );
}

function DeleteModal({ title, message, confirmText, setConfirmText, onCancel, onConfirm, deleting }: {
  title: string; message: React.ReactNode; confirmText: string;
  setConfirmText: (v: string) => void; onCancel: () => void; onConfirm: () => void; deleting: boolean;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.5)' }} onClick={onCancel} />
      <div style={{ position: 'relative', background: 'var(--bg-card)', borderRadius: '16px', padding: '28px', maxWidth: '480px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px -10px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '18px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(220,38,38,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><ShieldAlert size={22} style={{ color: '#dc2626' }} /></div>
          <div style={{ flex: 1 }}><h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>{title}</h3></div>
          <button type="button" onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dark)', padding: '4px' }}><X size={20} /></button>
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '20px' }}>{message}</div>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-dark)', marginBottom: '6px' }}>Type <strong style={{ color: '#dc2626' }}>DELETE</strong> to confirm:</label>
          <input type="text" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" style={{ width: '100%', padding: '10px 14px', border: `2px solid ${confirmText === 'DELETE' ? '#dc2626' : 'var(--border-subtle)'}`, borderRadius: '10px', fontSize: '0.9rem', fontWeight: 700, outline: 'none', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em' }} />
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="button" onClick={onConfirm} disabled={confirmText !== 'DELETE' || deleting} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: confirmText === 'DELETE' ? '#dc2626' : 'var(--bg-light)', color: confirmText === 'DELETE' ? '#fff' : 'var(--text-dark)', fontSize: '0.85rem', fontWeight: 700, cursor: confirmText === 'DELETE' && !deleting ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            {deleting ? <Loader2 size={16} className="crm-spin" /> : <Trash2 size={16} />} Delete Permanently
          </button>
          <button type="button" onClick={onCancel} style={{ padding: '10px 18px', borderRadius: '10px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-dark)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
