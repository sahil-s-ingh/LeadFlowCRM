import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import {
  BadgeCheck, CheckCircle2, AlertTriangle, Loader2, Send, FileText,
  Building2, ExternalLink, Info,
  RefreshCw, ArrowLeft, ShieldCheck, Clock, XCircle, ChevronDown,
} from 'lucide-react';

interface BlueTickApp {
  id: string;
  business_name: string;
  business_display_name: string;
  business_category: string;
  business_description: string;
  website_url: string | null;
  business_email: string;
  business_phone: string;
  address_line1: string;
  address_city: string;
  address_state: string | null;
  address_country: string;
  address_postal_code: string | null;
  waba_id: string | null;
  phone_number_id: string | null;
  documents_provided: string[];
  status: string;
  meta_application_id: string | null;
  meta_verification_status: string | null;
  rejection_reason: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  created_at: string;
}

const CATEGORIES = [
  'Financial Services', 'Insurance', 'Real Estate', 'Retail',
  'Technology', 'Healthcare', 'Education', 'Travel & Hospitality',
  'Food & Beverage', 'Professional Services', 'Other',
];

const DOCUMENT_TYPES = [
  { id: 'business_license', label: 'Business License / Registration' },
  { id: 'utility_bill', label: 'Utility Bill (Address Proof)' },
  { id: 'tax_certificate', label: 'Tax Registration Certificate' },
  { id: 'bank_statement', label: 'Bank Statement (Business)' },
  { id: 'domain_verification', label: 'Website Domain Verification' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  draft: { label: 'Draft', color: 'var(--text-muted)', bg: 'rgba(100,116,139,0.08)', icon: FileText },
  submitted: { label: 'Submitted', color: '#2563EB', bg: 'rgba(37,99,235,0.08)', icon: Send },
  in_review: { label: 'In Review', color: '#a16207', bg: 'rgba(234,179,8,0.08)', icon: Clock },
  approved: { label: 'Approved', color: '#15803d', bg: 'rgba(34,197,94,0.08)', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: '#b91c1c', bg: 'rgba(239,68,68,0.08)', icon: XCircle },
  resubmit: { label: 'Resubmit Required', color: '#a16207', bg: 'rgba(234,179,8,0.08)', icon: AlertTriangle },
};

export default function WhatsAppBlueTick({ session }: { session: Session }) {
  const [applications, setApplications] = useState<BlueTickApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingApp, setEditingApp] = useState<BlueTickApp | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [checkingStatus, setCheckingStatus] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  // Form fields
  const [bizName, setBizName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [addrLine1, setAddrLine1] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrState, setAddrState] = useState('');
  const [addrCountry, setAddrCountry] = useState('');
  const [addrPostal, setAddrPostal] = useState('');
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);

  const loadApplications = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('wa_blue_tick_applications')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });
      if (err) throw err;
      setApplications((data || []) as BlueTickApp[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  }, [session.user.id]);

  useEffect(() => { loadApplications(); }, [loadApplications]);

  const resetForm = () => {
    setBizName(''); setDisplayName(''); setCategory(''); setDescription('');
    setWebsite(''); setEmail(''); setPhone(''); setAddrLine1(''); setAddrCity('');
    setAddrState(''); setAddrCountry(''); setAddrPostal(''); setSelectedDocs([]);
    setEditingApp(null); setError(''); setSuccess('');
  };

  const startEdit = (app: BlueTickApp) => {
    setEditingApp(app);
    setBizName(app.business_name); setDisplayName(app.business_display_name);
    setCategory(app.business_category); setDescription(app.business_description);
    setWebsite(app.website_url || ''); setEmail(app.business_email);
    setPhone(app.business_phone); setAddrLine1(app.address_line1);
    setAddrCity(app.address_city); setAddrState(app.address_state || '');
    setAddrCountry(app.address_country); setAddrPostal(app.address_postal_code || '');
    setSelectedDocs(app.documents_provided || []);
    setShowForm(true); setError(''); setSuccess('');
  };

  const toggleDoc = (docId: string) => {
    setSelectedDocs((prev) => prev.includes(docId) ? prev.filter((d) => d !== docId) : [...prev, docId]);
  };

  const callEdgeFunction = async (payload: Record<string, unknown>) => {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wa-blue-tick`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  };

  const handleSubmit = async () => {
    if (!bizName.trim() || !displayName.trim() || !category || !description.trim() || !email.trim() || !phone.trim() || !addrLine1.trim() || !addrCity.trim() || !addrCountry.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    setSubmitting(true); setError(''); setSuccess('');
    try {
      const result = await callEdgeFunction({
        action: 'submit',
        application_id: editingApp?.id,
        business_name: bizName.trim(),
        business_display_name: displayName.trim(),
        business_category: category,
        business_description: description.trim(),
        website_url: website.trim(),
        business_email: email.trim(),
        business_phone: phone.trim(),
        address_line1: addrLine1.trim(),
        address_city: addrCity.trim(),
        address_state: addrState.trim(),
        address_country: addrCountry.trim(),
        address_postal_code: addrPostal.trim(),
        documents_provided: selectedDocs,
      });
      if (result.warning) {
        setSuccess('Application saved. ' + result.warning);
      } else {
        setSuccess('Application submitted successfully! Meta will review your business within 2-5 business days.');
      }
      setShowForm(false); resetForm();
      await loadApplications();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!bizName.trim()) { setError('Business name is required to save a draft.'); return; }
    setSubmitting(true); setError('');
    try {
      await callEdgeFunction({
        action: 'save_draft',
        application_id: editingApp?.id,
        business_name: bizName.trim(),
        business_display_name: displayName.trim(),
        business_category: category,
        business_description: description.trim(),
        website_url: website.trim(),
        business_email: email.trim(),
        business_phone: phone.trim(),
        address_line1: addrLine1.trim(),
        address_city: addrCity.trim(),
        address_state: addrState.trim(),
        address_country: addrCountry.trim(),
        address_postal_code: addrPostal.trim(),
        documents_provided: selectedDocs,
      });
      setSuccess('Draft saved. You can continue later.');
      setShowForm(false); resetForm();
      await loadApplications();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save draft');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckStatus = async (appId: string) => {
    setCheckingStatus(appId); setError('');
    try {
      await callEdgeFunction({ action: 'check_status', application_id: appId });
      await loadApplications();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to check status');
    } finally {
      setCheckingStatus(null);
    }
  };

  const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  const cardStyle: React.CSSProperties = { background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)', padding: '20px' };
  const labelStyle: React.CSSProperties = { fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', display: 'block', color: 'var(--text-main)' };
  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-light)', fontSize: '0.82rem', color: 'var(--text-main)', outline: 'none' };

  return (
    <div style={{ marginBottom: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <BadgeCheck size={22} style={{ color: '#25D366' }} />
        <div>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Official Business Account (Blue Tick) Verification
          </h3>
          <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
            Apply for the WhatsApp green badge that confirms your business identity to customers.
          </p>
        </div>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', marginBottom: '12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', color: '#dc2626', fontSize: '0.78rem' }}>
          <AlertTriangle size={14} /> {error}
        </div>
      )}
      {success && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', marginBottom: '12px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '8px', color: '#15803d', fontSize: '0.78rem' }}>
          <CheckCircle2 size={14} /> {success}
        </div>
      )}

      {/* Info banner */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '14px 16px', marginBottom: '16px', background: 'rgba(37,211,102,0.04)', borderRadius: '10px', border: '1px solid rgba(37,211,102,0.15)' }}>
        <Info size={16} style={{ color: '#25D366', flexShrink: 0, marginTop: '1px' }} />
        <div style={{ fontSize: '0.76rem', color: 'var(--text-dark)', lineHeight: 1.55 }}>
          The <strong>Official Business Account (OBA)</strong> badge — the green checkmark next to your business name —
          tells customers they're chatting with a verified business. Meta requires business verification, a confirmed
          phone number, and quality messaging history before approving. Review typically takes <strong>2-5 business days</strong>.
        </div>
      </div>

      {/* Collapsible guide */}
      <div style={{ marginBottom: '16px' }}>
        <button
          type="button"
          onClick={() => setShowGuide(!showGuide)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-light)', border: '1px solid var(--border-subtle)', borderRadius: '10px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={16} style={{ color: '#25D366' }} /> Eligibility & Requirements
          </span>
          <ChevronDown size={16} style={{ transform: showGuide ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>
        {showGuide && (
          <div style={{ padding: '16px', background: 'var(--bg-card)', borderRadius: '0 0 10px 10px', border: '1px solid var(--border-subtle)', borderTop: 'none' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' }}>
              {[
                { title: 'Active WhatsApp Business Number', desc: 'At least one connected number with CONNECTED status.' },
                { title: 'Business Verification', desc: 'Your Meta Business Manager must be verified with legal documents.' },
                { title: 'Quality Messaging History', desc: 'Consistent positive customer engagement with no quality bans.' },
                { title: 'Tier 2 or Higher', desc: 'Messaging limit should ideally be TIER_10K or above.' },
                { title: 'Accurate Display Name', desc: 'Must match your legal business name exactly.' },
                { title: 'Official Website', desc: 'A live, accessible business website strengthens your application.' },
              ].map((req) => (
                <div key={req.title} style={{ padding: '12px', background: 'var(--bg-light)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <CheckCircle2 size={14} style={{ color: '#25D366' }} />
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)' }}>{req.title}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{req.desc}</p>
                </div>
              ))}
            </div>
            <a href="https://business.facebook.com/wa/manage/phone-numbers" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', marginTop: '12px', fontSize: '0.76rem', color: '#25D366', fontWeight: 600 }}>
              Open Meta Business Manager <ExternalLink size={13} />
            </a>
          </div>
        )}
      </div>

      {/* Form */}
      {showForm ? (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building2 size={18} style={{ color: '#25D366' }} />
              <strong style={{ fontSize: '0.88rem' }}>{editingApp ? 'Edit Application' : 'New Blue Tick Application'}</strong>
            </div>
            <button type="button" onClick={() => { setShowForm(false); resetForm(); }} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', background: 'var(--bg-card)' }}>
              <ArrowLeft size={13} /> Back
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Legal Business Name <em style={{ color: '#ef4444' }}>*</em></label>
              <input style={inputStyle} value={bizName} onChange={(e) => setBizName(e.target.value)} placeholder="e.g. Sahil Exchange Pvt Ltd" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>WhatsApp Display Name <em style={{ color: '#ef4444' }}>*</em></label>
              <input style={inputStyle} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Sahil Exchange" />
              <small style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>This is the name that appears with the blue tick on WhatsApp.</small>
            </div>
            <div>
              <label style={labelStyle}>Business Category <em style={{ color: '#ef4444' }}>*</em></label>
              <select style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Select category...</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Website</label>
              <input style={inputStyle} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://example.com" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Business Description <em style={{ color: '#ef4444' }}>*</em></label>
              <textarea style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Briefly describe what your business does..." />
            </div>
            <div>
              <label style={labelStyle}>Business Email <em style={{ color: '#ef4444' }}>*</em></label>
              <input style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contact@example.com" />
            </div>
            <div>
              <label style={labelStyle}>Business Phone <em style={{ color: '#ef4444' }}>*</em></label>
              <input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1234567890" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Business Address <em style={{ color: '#ef4444' }}>*</em></label>
              <input style={{ ...inputStyle, marginBottom: '8px' }} value={addrLine1} onChange={(e) => setAddrLine1(e.target.value)} placeholder="Street address" />
            </div>
            <div>
              <label style={labelStyle}>City <em style={{ color: '#ef4444' }}>*</em></label>
              <input style={inputStyle} value={addrCity} onChange={(e) => setAddrCity(e.target.value)} placeholder="City" />
            </div>
            <div>
              <label style={labelStyle}>State / Province</label>
              <input style={inputStyle} value={addrState} onChange={(e) => setAddrState(e.target.value)} placeholder="State" />
            </div>
            <div>
              <label style={labelStyle}>Country <em style={{ color: '#ef4444' }}>*</em></label>
              <input style={inputStyle} value={addrCountry} onChange={(e) => setAddrCountry(e.target.value)} placeholder="Country" />
            </div>
            <div>
              <label style={labelStyle}>Postal / ZIP Code</label>
              <input style={inputStyle} value={addrPostal} onChange={(e) => setAddrPostal(e.target.value)} placeholder="Postal code" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Documents Available for Verification</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px', background: 'var(--bg-light)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                {DOCUMENT_TYPES.map((doc) => (
                  <label key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', cursor: 'pointer', color: 'var(--text-main)' }}>
                    <input type="checkbox" checked={selectedDocs.includes(doc.id)} onChange={() => toggleDoc(doc.id)} style={{ width: '16px', height: '16px', accentColor: '#25D366', cursor: 'pointer' }} />
                    {doc.label}
                  </label>
                ))}
                <small style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>You'll upload these documents in Meta Business Manager during the verification step.</small>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
            <button type="button" onClick={handleSubmit} disabled={submitting} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 22px', border: 'none', borderRadius: '8px', background: submitting ? '#94a3b8' : '#25D366', color: '#fff', fontSize: '0.82rem', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer' }}>
              {submitting ? <Loader2 size={15} className="crm-spin" /> : <Send size={15} />} Submit Application
            </button>
            <button type="button" onClick={handleSaveDraft} disabled={submitting} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 18px', border: '1px solid var(--border-subtle)', borderRadius: '8px', background: 'var(--bg-card)', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
              Save as Draft
            </button>
            <button type="button" onClick={() => { setShowForm(false); resetForm(); }} style={{ padding: '9px 16px', border: '1px solid var(--border-subtle)', borderRadius: '8px', background: 'var(--bg-card)', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* New application button */}
          <button
            type="button"
            onClick={() => { resetForm(); setShowForm(true); }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px', border: '2px dashed rgba(37,211,102,0.3)', borderRadius: '12px', background: 'rgba(37,211,102,0.04)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, color: '#25D366', marginBottom: '16px', transition: 'all 0.15s' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#25D366'; e.currentTarget.style.background = 'rgba(37,211,102,0.08)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(37,211,102,0.3)'; e.currentTarget.style.background = 'rgba(37,211,102,0.04)'; }}
          >
            <BadgeCheck size={18} /> Apply for Blue Tick Verification
          </button>

          {/* Applications list */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              <Loader2 size={22} className="crm-spin" style={{ marginBottom: 8, color: '#25D366' }} /> Loading applications...
            </div>
          ) : applications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              <BadgeCheck size={32} style={{ opacity: 0.2, marginBottom: 8 }} />
              <p>No applications yet. Click above to start your blue tick verification.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {applications.map((app) => {
                const sc = STATUS_CONFIG[app.status] || STATUS_CONFIG.draft;
                const StatusIcon = sc.icon;
                return (
                  <div key={app.id} style={{ padding: '16px', background: 'var(--bg-card)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(37,211,102,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Building2 size={18} style={{ color: '#25D366' }} />
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>{app.business_display_name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{app.business_name} · {app.business_category}</div>
                        </div>
                      </div>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '9999px', background: sc.bg, color: sc.color, fontSize: '0.72rem', fontWeight: 700 }}>
                        <StatusIcon size={13} /> {sc.label}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '8px', marginBottom: '10px' }}>
                      <div style={{ padding: '8px 10px', background: 'var(--bg-light)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-dark)', marginBottom: '3px' }}>Submitted</div>
                        <div style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-main)' }}>{fmtDate(app.submitted_at)}</div>
                      </div>
                      <div style={{ padding: '8px 10px', background: 'var(--bg-light)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-dark)', marginBottom: '3px' }}>Reviewed</div>
                        <div style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-main)' }}>{fmtDate(app.reviewed_at)}</div>
                      </div>
                      <div style={{ padding: '8px 10px', background: 'var(--bg-light)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-dark)', marginBottom: '3px' }}>Documents</div>
                        <div style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-main)' }}>{app.documents_provided.length} provided</div>
                      </div>
                    </div>

                    {app.rejection_reason && (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '10px 12px', background: 'rgba(239,68,68,0.06)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.15)', fontSize: '0.74rem', color: '#b91c1c', marginBottom: '10px', lineHeight: 1.5 }}>
                        <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '1px' }} /> Rejection reason: {app.rejection_reason}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {app.status !== 'approved' && (
                        <button type="button" onClick={() => handleCheckStatus(app.id)} disabled={checkingStatus === app.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 14px', border: '1px solid var(--border-subtle)', borderRadius: '6px', background: 'var(--bg-card)', color: '#25D366', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer' }}>
                          {checkingStatus === app.id ? <Loader2 size={13} className="crm-spin" /> : <RefreshCw size={13} />} Check Status
                        </button>
                      )}
                      {(app.status === 'draft' || app.status === 'rejected' || app.status === 'resubmit') && (
                        <button type="button" onClick={() => startEdit(app)} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 14px', border: '1px solid var(--border-subtle)', borderRadius: '6px', background: 'var(--bg-card)', color: 'var(--text-muted)', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer' }}>
                          <FileText size={13} /> {app.status === 'draft' ? 'Continue' : 'Resubmit'}
                        </button>
                      )}
                      {app.status === 'approved' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: '6px', background: 'rgba(34,197,94,0.08)', color: '#15803d', fontSize: '0.76rem', fontWeight: 700 }}>
                          <BadgeCheck size={14} /> Verified
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
