import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import {
  ArrowLeft, Plus, Trash2, Edit3, Building2, Users, DollarSign,
  TrendingUp, Loader2, Save, X, Globe, ExternalLink, Search,
  CheckCircle2, AlertTriangle, CreditCard, Target, Upload, Image as ImageIcon,
  UserCheck, Hash,
} from 'lucide-react';

type Broker = {
  id: string;
  name: string;
  website: string | null;
  logo_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

type BrokerStat = {
  broker: Broker;
  totalClients: number;
  interestedClients: number;
  convertedClients: number;
  totalDeposits: number;
  totalPurchaseValue: number;
  newAccounts: number;
  existingAccounts: number;
  partnerCodesChanged: number;
};

type Lead = {
  id: string;
  full_name: string;
  status: string;
  fund_amount: number | null;
  purchase_value: number | null;
  broker_id: string | null;
  account_type: 'new_account' | 'existing_account' | null;
  partner_code: string | null;
  mobile_number: string;
  email: string;
};

export default function BrokerTrackerPage({ session, onBack }: { session: Session; onBack: () => void }) {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBroker, setEditingBroker] = useState<Broker | null>(null);
  const [brokerName, setBrokerName] = useState('');
  const [brokerWebsite, setBrokerWebsite] = useState('');
  const [brokerLogoUrl, setBrokerLogoUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedBroker, setExpandedBroker] = useState<string | null>(null);
  const [brokerLeads, setBrokerLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: brokerData, error: brokerErr } = await supabase
      .from('brokers')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (brokerErr) {
      setError(brokerErr.message);
      setLoading(false);
      return;
    }

    const { data: leadData } = await supabase
      .from('submissions')
      .select('id, full_name, status, fund_amount, purchase_value, broker_id, account_type, partner_code, mobile_number, email')
      .is('deleted_at', null);

    setBrokers((brokerData || []) as Broker[]);
    setLeads((leadData || []) as Lead[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setBrokerName('');
    setBrokerWebsite('');
    setBrokerLogoUrl('');
    setError('');
    setSuccess('');
    setEditingBroker(null);
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const handleLogoUpload = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      setError('Logo image must be under 2MB.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file.');
      return;
    }
    setUploadingLogo(true);
    setError('');
    try {
      const fileExt = file.name.split('.').pop() || 'png';
      const filePath = `${session.user.id}/${Date.now()}.${fileExt}`;
      const { error: upErr } = await supabase.storage
        .from('broker-logos')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });
      if (upErr) {
        setError(upErr.message);
        setUploadingLogo(false);
        return;
      }
      const { data: urlData } = supabase.storage
        .from('broker-logos')
        .getPublicUrl(filePath);
      setBrokerLogoUrl(urlData.publicUrl);
    } catch {
      setError('Failed to upload logo.');
    }
    setUploadingLogo(false);
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const startEdit = (b: Broker) => {
    setEditingBroker(b);
    setBrokerName(b.name);
    setBrokerWebsite(b.website || '');
    setBrokerLogoUrl(b.logo_url || '');
    setShowAddForm(true);
    setError('');
    setSuccess('');
  };

  const handleSave = async () => {
    if (!brokerName.trim()) {
      setError('Broker name is required.');
      return;
    }
    setSaving(true);
    setError('');
    const payload = {
      user_id: session.user.id,
      name: brokerName.trim(),
      website: brokerWebsite.trim() || null,
      logo_url: brokerLogoUrl.trim() || null,
      sort_order: editingBroker?.sort_order ?? brokers.length,
      is_active: editingBroker?.is_active ?? true,
      updated_at: new Date().toISOString(),
    };

    if (editingBroker) {
      const { error: updErr } = await supabase.from('brokers').update(payload).eq('id', editingBroker.id);
      if (updErr) { setError(updErr.message); setSaving(false); return; }
      setSuccess('Broker updated successfully.');
    } else {
      const { error: insErr } = await supabase.from('brokers').insert(payload);
      if (insErr) { setError(insErr.message); setSaving(false); return; }
      setSuccess('Broker added successfully.');
    }

    setSaving(false);
    setShowAddForm(false);
    resetForm();
    fetchData();
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleDelete = async (id: string) => {
    const broker = brokers.find((b) => b.id === id);
    const linkedCount = leads.filter((l) => l.broker_id === id).length;
    if (linkedCount > 0) {
      const confirmed = window.confirm(
        `${broker?.name} has ${linkedCount} lead${linkedCount !== 1 ? 's' : ''} linked to it. Deleting will unlink those leads but won't delete them. Continue?`
      );
      if (!confirmed) return;
    } else {
      const confirmed = window.confirm(`Delete broker "${broker?.name}"? This cannot be undone.`);
      if (!confirmed) return;
    }

    setDeletingId(id);
    const { error: delErr } = await supabase.from('brokers').delete().eq('id', id);
    if (delErr) {
      setError(delErr.message);
      setDeletingId(null);
      return;
    }
    setBrokers((prev) => prev.filter((b) => b.id !== id));
    setDeletingId(null);
    setSuccess('Broker deleted.');
    fetchData();
    setTimeout(() => setSuccess(''), 3000);
  };

  const fetchBrokerLeads = async (brokerId: string) => {
    setLoadingLeads(true);
    const { data } = await supabase
      .from('submissions')
      .select('id, full_name, status, fund_amount, purchase_value, broker_id, account_type, partner_code, mobile_number, email')
      .eq('broker_id', brokerId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    setBrokerLeads((data || []) as Lead[]);
    setLoadingLeads(false);
  };

  const toggleExpand = (brokerId: string) => {
    if (expandedBroker === brokerId) {
      setExpandedBroker(null);
      setBrokerLeads([]);
    } else {
      setExpandedBroker(brokerId);
      fetchBrokerLeads(brokerId);
    }
  };

  const stats: BrokerStat[] = brokers.map((broker) => {
    const brokerLeads = leads.filter((l) => l.broker_id === broker.id);
    return {
      broker,
      totalClients: brokerLeads.length,
      interestedClients: brokerLeads.filter((l) => l.status === 'interested').length,
      convertedClients: brokerLeads.filter((l) => l.status === 'converted').length,
      totalDeposits: brokerLeads.reduce((sum, l) => sum + (l.fund_amount || 0), 0),
      totalPurchaseValue: brokerLeads.reduce((sum, l) => sum + (l.purchase_value || 0), 0),
      newAccounts: brokerLeads.filter((l) => l.account_type === 'new_account').length,
      existingAccounts: brokerLeads.filter((l) => l.account_type === 'existing_account').length,
      partnerCodesChanged: brokerLeads.filter((l) => l.partner_code && l.partner_code.trim().length > 0).length,
    };
  });

  const filteredStats = stats.filter((s) =>
    s.broker.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalAllDeposits = stats.reduce((sum, s) => sum + s.totalDeposits, 0);
  const totalAllClients = stats.reduce((sum, s) => sum + s.totalClients, 0);
  const totalAllConverted = stats.reduce((sum, s) => sum + s.convertedClients, 0);
  const totalAllPurchase = stats.reduce((sum, s) => sum + s.totalPurchaseValue, 0);
  const totalAllNewAccounts = stats.reduce((sum, s) => sum + s.newAccounts, 0);
  const totalAllExistingAccounts = stats.reduce((sum, s) => sum + s.existingAccounts, 0);
  const totalAllPartnerCodes = stats.reduce((sum, s) => sum + s.partnerCodesChanged, 0);

  const formatCurrency = (n: number) => {
    if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
    return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  };

  const statusColors: Record<string, { bg: string; text: string; border: string }> = {
    new: { bg: 'rgba(59,130,246,0.1)', text: '#2563eb', border: 'rgba(59,130,246,0.3)' },
    called_no_response: { bg: 'rgba(245,158,11,0.1)', text: '#d97706', border: 'rgba(245,158,11,0.3)' },
    called_responded: { bg: 'rgba(6,182,212,0.1)', text: '#0891b2', border: 'rgba(6,182,212,0.3)' },
    interested: { bg: 'rgba(139,92,246,0.1)', text: '#7c3aed', border: 'rgba(139,92,246,0.3)' },
    not_interested: { bg: 'rgba(239,68,68,0.1)', text: '#dc2626', border: 'rgba(239,68,68,0.3)' },
    converted: { bg: 'rgba(22,163,74,0.1)', text: '#16a34a', border: 'rgba(22,163,74,0.3)' },
  };

  const statusLabel = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="dash-overview">
      <div className="dash-page-header">
        <button className="dash-back-btn" onClick={onBack}>
          <ArrowLeft size={18} /> Back
        </button>
        <h1>Broker Tracker</h1>
        <p>Track which brokers your clients use, how many deposits they've made, and which partnerships drive the most revenue</p>
      </div>

      {success && (
        <div style={{
          background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.3)',
          borderRadius: '10px', padding: '12px 16px', color: '#16a34a',
          fontSize: '0.85rem', fontWeight: 600, marginBottom: '16px',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <CheckCircle2 size={16} /> {success}
        </div>
      )}

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '10px', padding: '12px 16px', color: '#dc2626',
          fontSize: '0.85rem', fontWeight: 600, marginBottom: '16px',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* Summary Cards */}
      {!loading && brokers.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border-subtle)', padding: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 size={24} style={{ color: '#2563eb' }} />
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1 }}>{brokers.length}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dark)', marginTop: '4px' }}>Active Brokers</div>
            </div>
          </div>
          <div style={{ background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border-subtle)', padding: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={24} style={{ color: '#7c3aed' }} />
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1 }}>{totalAllClients}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dark)', marginTop: '4px' }}>Total Clients Linked</div>
            </div>
          </div>
          <div style={{ background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border-subtle)', padding: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(22,163,74,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={24} style={{ color: '#16a34a' }} />
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1 }}>{formatCurrency(totalAllDeposits)}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dark)', marginTop: '4px' }}>Total Deposits</div>
            </div>
          </div>
          <div style={{ background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border-subtle)', padding: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(13,148,136,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Target size={24} style={{ color: '#0d9488' }} />
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1 }}>{totalAllConverted}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dark)', marginTop: '4px' }}>Conversions</div>
            </div>
          </div>
          <div style={{ background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border-subtle)', padding: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(6,182,212,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserCheck size={24} style={{ color: '#0891b2' }} />
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1 }}>{totalAllNewAccounts}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dark)', marginTop: '4px' }}>New Accounts</div>
            </div>
          </div>
          <div style={{ background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border-subtle)', padding: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Hash size={24} style={{ color: '#d97706' }} />
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1 }}>{totalAllPartnerCodes}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dark)', marginTop: '4px' }}>Partner Codes Used</div>
            </div>
          </div>
        </div>
      )}

      {/* Search + Add Button */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dark)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search brokers..."
            style={{ width: '100%', padding: '10px 12px 10px 38px', border: '1px solid var(--border-subtle)', borderRadius: '10px', fontSize: '0.85rem', outline: 'none' }}
          />
        </div>
        <button
          onClick={() => { resetForm(); setShowAddForm(true); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '10px 18px', border: 'none', borderRadius: '10px',
            background: '#2563eb', color: 'var(--bg-card)', fontSize: '0.85rem', fontWeight: 700,
            cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#1e40af'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#2563eb'; }}
        >
          <Plus size={18} /> Add Broker
        </button>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div style={{
          background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border-subtle)',
          padding: '24px', marginBottom: '20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              {editingBroker ? 'Edit Broker' : 'Add New Broker'}
            </h3>
            <button onClick={() => { setShowAddForm(false); resetForm(); }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-dark)', padding: '4px' }}>
              <X size={20} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Broker Name *</span>
              <input
                type="text"
                value={brokerName}
                onChange={(e) => setBrokerName(e.target.value)}
                placeholder="e.g. Exness, IC Markets, Pepperstone"
                style={{ padding: '10px 14px', border: '1px solid var(--border-subtle)', borderRadius: '8px', fontSize: '0.85rem', outline: 'none' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Website</span>
              <input
                type="url"
                value={brokerWebsite}
                onChange={(e) => setBrokerWebsite(e.target.value)}
                placeholder="https://broker.com"
                style={{ padding: '10px 14px', border: '1px solid var(--border-subtle)', borderRadius: '8px', fontSize: '0.85rem', outline: 'none' }}
              />
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Broker Logo</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '56px', height: '56px', borderRadius: '10px',
                  background: brokerLogoUrl ? 'transparent' : 'var(--bg-light)',
                  border: '1px solid var(--border-subtle)', overflow: 'hidden', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {brokerLogoUrl ? (
                    <img src={brokerLogoUrl} alt="Logo preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : uploadingLogo ? (
                    <Loader2 size={20} className="crm-spin" style={{ color: 'var(--text-dark)' }} />
                  ) : (
                    <ImageIcon size={22} style={{ color: 'var(--text-dark)' }} />
                  )}
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadingLogo}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '8px 14px', border: '1px dashed var(--border-subtle)', borderRadius: '8px',
                      background: 'var(--bg-light)', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600,
                      cursor: uploadingLogo ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
                      opacity: uploadingLogo ? 0.6 : 1,
                    }}
                    onMouseEnter={(e) => { if (!uploadingLogo) { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.color = '#2563eb'; } }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                  >
                    <Upload size={14} /> {brokerLogoUrl ? 'Replace Image' : 'Upload Logo'}
                  </button>
                  {brokerLogoUrl && (
                    <button
                      type="button"
                      onClick={() => setBrokerLogoUrl('')}
                      disabled={uploadingLogo}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px',
                        border: '1px solid #fecaca', borderRadius: '6px', background: 'var(--bg-card)',
                        color: '#dc2626', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
                        width: 'fit-content',
                      }}
                    >
                      <Trash2 size={12} /> Remove
                    </button>
                  )}
                </div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleLogoUpload(file);
                  }}
                  style={{ display: 'none' }}
                />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button
              onClick={handleSave}
              disabled={saving || !brokerName.trim()}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '10px 20px', border: 'none', borderRadius: '8px',
                background: saving ? '#94a3b8' : '#2563eb', color: 'var(--bg-card)',
                fontSize: '0.85rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {saving ? <Loader2 size={16} className="crm-spin" /> : <Save size={16} />}
              {saving ? 'Saving...' : editingBroker ? 'Update Broker' : 'Add Broker'}
            </button>
            <button
              onClick={() => { setShowAddForm(false); resetForm(); }}
              style={{
                padding: '10px 20px', border: '1px solid var(--border-subtle)', borderRadius: '8px',
                background: 'var(--bg-card)', color: 'var(--text-dark)', fontSize: '0.85rem', fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
          <Loader2 size={28} className="crm-spin" style={{ color: '#2563eb' }} />
        </div>
      ) : brokers.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border-subtle)',
        }}>
          <Building2 size={48} style={{ color: 'var(--text-dark)', marginBottom: '16px' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>No brokers yet</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-dark)', maxWidth: '420px', margin: '0 auto 20px' }}>
            Add the brokers your clients trade with. Once added, you can select them from each lead's profile and track deposits and conversions per broker here.
          </p>
          <button
            onClick={() => { resetForm(); setShowAddForm(true); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '10px 20px', border: 'none', borderRadius: '10px',
              background: '#2563eb', color: 'var(--bg-card)', fontSize: '0.85rem', fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Plus size={18} /> Add Your First Broker
          </button>
        </div>
      ) : filteredStats.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dark)', fontSize: '0.85rem' }}>
          No brokers match your search.
        </div>
      ) : (
        /* Broker Cards */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredStats.map((stat) => {
            const conversionRate = stat.totalClients > 0
              ? Math.round((stat.convertedClients / stat.totalClients) * 100)
              : 0;
            const isExpanded = expandedBroker === stat.broker.id;
            return (
              <div key={stat.broker.id} style={{
                background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border-subtle)',
                overflow: 'hidden', transition: 'box-shadow 0.2s',
              }}>
                {/* Broker Header */}
                <div
                  onClick={() => toggleExpand(stat.broker.id)}
                  style={{ padding: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}
                >
                  {/* Logo / Avatar */}
                  <div style={{
                    width: '56px', height: '56px', borderRadius: '12px',
                    background: stat.broker.logo_url ? 'transparent' : 'linear-gradient(135deg, #2563eb, #1e40af)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, overflow: 'hidden', border: '1px solid var(--border-subtle)',
                  }}>
                    {stat.broker.logo_url ? (
                      <img src={stat.broker.logo_url} alt={stat.broker.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Building2 size={26} style={{ color: 'var(--bg-card)' }} />
                    )}
                  </div>

                  {/* Name + Website */}
                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>{stat.broker.name}</h3>
                      {stat.broker.website && (
                        <a href={stat.broker.website} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: '#2563eb', display: 'flex' }}>
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                    {stat.broker.website && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                        <Globe size={12} style={{ color: 'var(--text-dark)' }} />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>{stat.broker.website.replace(/^https?:\/\//, '')}</span>
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#7c3aed' }}>{stat.totalClients}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dark)', marginTop: '2px' }}>Clients</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#16a34a' }}>{formatCurrency(stat.totalDeposits)}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dark)', marginTop: '2px' }}>Deposits</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0891b2' }}>{stat.newAccounts}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dark)', marginTop: '2px' }}>New Accounts</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#d97706' }}>{stat.partnerCodesChanged}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dark)', marginTop: '2px' }}>Partner Codes</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0d9488' }}>{conversionRate}%</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dark)', marginTop: '2px' }}>Conv. Rate</div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); startEdit(stat.broker); }}
                      style={{
                        width: '34px', height: '34px', borderRadius: '8px',
                        border: '1px solid var(--border-subtle)', background: 'var(--bg-light)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: '#2563eb', transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#2563eb'; e.currentTarget.style.color = '#fff'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-light)'; e.currentTarget.style.color = '#2563eb'; }}
                      title="Edit broker"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(stat.broker.id); }}
                      disabled={deletingId === stat.broker.id}
                      style={{
                        width: '34px', height: '34px', borderRadius: '8px',
                        border: '1px solid var(--border-subtle)', background: 'var(--bg-light)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: '#dc2626', transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#dc2626'; e.currentTarget.style.color = '#fff'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-light)'; e.currentTarget.style.color = '#dc2626'; }}
                      title="Delete broker"
                    >
                      {deletingId === stat.broker.id ? <Loader2 size={15} className="crm-spin" /> : <Trash2 size={15} />}
                    </button>
                  </div>
                </div>

                {/* Expanded: Lead List */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '16px 20px' }}>
                    {loadingLeads ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
                        <Loader2 size={22} className="crm-spin" style={{ color: '#2563eb' }} />
                      </div>
                    ) : brokerLeads.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-dark)', fontSize: '0.85rem' }}>
                        No leads linked to this broker yet. Select this broker from a lead's profile to link them.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {brokerLeads.map((lead) => {
                          const sc = statusColors[lead.status] || { bg: 'var(--bg-light)', text: 'var(--text-muted)', border: 'var(--border-subtle)' };
                          return (
                            <div key={lead.id} style={{
                              display: 'flex', alignItems: 'center', gap: '12px',
                              padding: '10px 14px', borderRadius: '10px',
                              background: 'var(--bg-light)', border: '1px solid var(--border-subtle)',
                            }}>
                              <div style={{
                                width: '36px', height: '36px', borderRadius: '50%',
                                background: sc.bg, color: sc.text,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
                              }}>
                                {lead.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                              </div>
                              <div style={{ flex: 1, minWidth: '120px' }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>{lead.full_name}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-dark)' }}>{lead.email || lead.mobile_number}</div>
                              </div>
                              <span style={{
                                fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px',
                                borderRadius: '100px', background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`,
                                whiteSpace: 'nowrap',
                              }}>
                                {statusLabel(lead.status)}
                              </span>
                              {lead.fund_amount != null && lead.fund_amount > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 700, color: '#16a34a' }}>
                                  <CreditCard size={14} /> {formatCurrency(lead.fund_amount)}
                                </div>
                              )}
                              {lead.account_type && (
                                <span style={{
                                  fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px',
                                  borderRadius: '100px', whiteSpace: 'nowrap',
                                  background: lead.account_type === 'new_account' ? 'rgba(6,182,212,0.1)' : 'rgba(100,116,139,0.1)',
                                  color: lead.account_type === 'new_account' ? '#0891b2' : 'var(--text-dark)',
                                  border: lead.account_type === 'new_account' ? '1px solid rgba(6,182,212,0.3)' : '1px solid rgba(100,116,139,0.3)',
                                  display: 'flex', alignItems: 'center', gap: '3px',
                                }}>
                                  <UserCheck size={10} />
                                  {lead.account_type === 'new_account' ? 'New Account' : 'Existing Account'}
                                </span>
                              )}
                              {lead.partner_code && lead.partner_code.trim() && (
                                <span style={{
                                  fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px',
                                  borderRadius: '100px', whiteSpace: 'nowrap',
                                  background: 'rgba(37,99,235,0.08)', color: '#2563eb',
                                  border: '1px solid rgba(37,99,235,0.2)',
                                  display: 'flex', alignItems: 'center', gap: '3px',
                                }}>
                                  <Hash size={10} /> {lead.partner_code}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
