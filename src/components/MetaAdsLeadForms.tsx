import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { FileText, Plus, RefreshCw, Loader2, AlertCircle, CheckCircle2, Download, ArrowRight } from 'lucide-react';

interface MetaAdsLeadFormsProps {
  session: { user: { id: string } };
  callApi: (action: string, extra?: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

interface LeadForm {
  id: string;
  name: string;
  page_id: string | null;
  form_id: string | null;
  status: string;
  leads_count: number;
  created_at: string;
}

interface LeadFormLead {
  id: string;
  leadgen_id: string;
  field_data: Array<{ name: string; values: string[] }>;
  created_at: string;
  synced_to_crm: boolean;
}

export default function MetaAdsLeadForms({ session, callApi }: MetaAdsLeadFormsProps) {
  const [forms, setForms] = useState<LeadForm[]>([]);
  const [metaForms, setMetaForms] = useState<Array<Record<string, unknown>>>([]);
  const [leads, setLeads] = useState<LeadFormLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [formName, setFormName] = useState('');
  const [formPageId, setFormPageId] = useState('');
  const [fbPages, setFbPages] = useState<Array<{ id: string; name: string }>>([]);
  const [formPrivacyUrl, setFormPrivacyUrl] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: formData } = await supabase.from('meta_lead_forms').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false });
      if (formData) setForms(formData as LeadForm[]);
    } catch { /* ignore */ }
    setLoading(false);
  }, [session.user.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleFetchPages = async () => {
    setActionLoading(true);
    setError('');
    try {
      const result = await callApi('get_pages');
      setFbPages((result.pages as Array<{ id: string; name: string }>) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch pages');
    }
    setActionLoading(false);
  };

  const handleCreateForm = async () => {
    if (!formName.trim() || !formPageId) { setError('Form name and Page are required'); return; }
    setActionLoading(true);
    setError('');
    try {
      await callApi('create_lead_form', {
        name: formName.trim(),
        page_id: formPageId,
        privacy_policy_url: formPrivacyUrl || undefined,
      });
      setSuccess('Lead form created');
      setFormName(''); setFormPageId(''); setFormPrivacyUrl('');
      setShowCreate(false);
      await loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create lead form');
    }
    setActionLoading(false);
  };

  const handleSyncForms = async () => {
    setActionLoading(true);
    setError('');
    try {
      const result = await callApi('list_lead_forms');
      setMetaForms((result.forms as Array<Record<string, unknown>>) || []);
      await loadData();
      setSuccess('Lead forms synced from Meta');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync forms');
    }
    setActionLoading(false);
  };

  const handleFetchLeads = async (formId: string) => {
    setSelectedFormId(formId);
    setActionLoading(true);
    setError('');
    try {
      const result = await callApi('get_lead_form_leads', { form_id: formId });
      const metaLeads = (result.leads as Array<Record<string, unknown>>) || [];
      // Fetch from DB
      const { data: dbLeads } = await supabase.from('meta_lead_form_leads').select('*').eq('form_id', formId).eq('user_id', session.user.id).order('created_at', { ascending: false });
      setLeads((dbLeads as LeadFormLead[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch leads');
    }
    setActionLoading(false);
  };

  const handleSyncToCrm = async (leadgenId: string) => {
    setActionLoading(true);
    setError('');
    try {
      await callApi('sync_lead_to_crm', { leadgen_id: leadgenId });
      setLeads((prev) => prev.map((l) => l.leadgen_id === leadgenId ? { ...l, synced_to_crm: true } : l));
      setSuccess('Lead synced to CRM');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync lead');
    }
    setActionLoading(false);
  };

  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid var(--border-subtle)', borderRadius: '8px', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.85rem', outline: 'none' };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>Lead Form Ads</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handleSyncForms} disabled={actionLoading} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            {actionLoading ? <Loader2 size={15} className="crm-spin" /> : <RefreshCw size={15} />} Sync from Meta
          </button>
          <button onClick={() => { handleFetchPages(); setShowCreate(true); }} style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: '#1877F2', color: '#fff', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={15} /> Create Lead Form
          </button>
        </div>
      </div>

      {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '12px 16px', color: '#dc2626', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}><AlertCircle size={16} /> {error}</div>}
      {success && <div style={{ background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.3)', borderRadius: '10px', padding: '12px 16px', color: '#16a34a', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} /> {success}</div>}

      {/* Create form */}
      {showCreate && (
        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)', padding: '24px' }}>
          <h4 style={{ margin: '0 0 6px', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>Create Lead Form Ad</h4>
          <p style={{ margin: '0 0 16px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Create a native Facebook/Instagram lead collection form. Leads are captured directly in Facebook and can be synced to your CRM.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Form Name *</label>
              <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Trading Lead Form — Q4" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Facebook Page *</label>
              <select value={formPageId} onChange={(e) => setFormPageId(e.target.value)} style={inputStyle}>
                <option value="">Select a Page...</option>
                {fbPages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {fbPages.length === 0 && <small style={{ fontSize: '0.74rem', color: 'var(--text-dark)', marginTop: '4px', display: 'block' }}>Click "Create Lead Form" to load your pages first.</small>}
            </div>
            <div>
              <label style={labelStyle}>Privacy Policy URL (optional)</label>
              <input type="text" value={formPrivacyUrl} onChange={(e) => setFormPrivacyUrl(e.target.value)} placeholder="https://yoursite.com/privacy" style={inputStyle} />
            </div>
          </div>
          <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
            <button onClick={handleCreateForm} disabled={actionLoading || !formName.trim() || !formPageId} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: formName.trim() && formPageId && !actionLoading ? '#1877F2' : '#cbd5e1', color: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {actionLoading ? <Loader2 size={16} className="crm-spin" /> : <FileText size={16} />} Create Form
            </button>
            <button onClick={() => setShowCreate(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Forms list */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><Loader2 size={24} className="crm-spin" style={{ color: '#1877F2' }} /></div>
      ) : forms.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
          <FileText size={36} style={{ color: 'var(--text-dark)', margin: '0 auto 10px' }} />
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No lead forms yet. Create one to collect leads directly on Facebook.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {forms.map((form) => (
            <div key={form.id} style={{ background: 'var(--bg-card)', borderRadius: '10px', border: '1px solid var(--border-subtle)', padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>{form.name}</div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-dark)', marginTop: '4px' }}>
                    {form.status} &middot; {form.leads_count || 0} leads collected
                    {form.form_id && ` &middot; ID: ${form.form_id}`}
                  </div>
                </div>
                <button onClick={() => handleFetchLeads(form.form_id!)} disabled={actionLoading || !form.form_id} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Download size={14} /> Fetch Leads
                </button>
              </div>

              {/* Leads for this form */}
              {selectedFormId === form.form_id && leads.length > 0 && (
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-light)' }}>
                          <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, fontSize: '0.72rem', color: 'var(--text-main)', textTransform: 'uppercase' }}>Field</th>
                          <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, fontSize: '0.72rem', color: 'var(--text-main)', textTransform: 'uppercase' }}>Value</th>
                          <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, fontSize: '0.72rem', color: 'var(--text-main)', textTransform: 'uppercase' }}>Date</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, fontSize: '0.72rem', color: 'var(--text-main)', textTransform: 'uppercase' }}>Sync</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leads.map((lead) => {
                          const fieldData = (lead.field_data || []) as Array<{ name: string; values: string[] }>;
                          return fieldData.map((field, fi) => (
                            <tr key={`${lead.id}-${fi}`} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <td style={{ padding: '8px 10px', fontSize: '0.78rem', color: 'var(--text-main)', fontWeight: 600 }}>{field.name}</td>
                              <td style={{ padding: '8px 10px', fontSize: '0.78rem', color: 'var(--text-main)' }}>{field.values?.[0] || '—'}</td>
                              <td style={{ padding: '8px 10px', fontSize: '0.78rem', color: 'var(--text-dark)' }}>{fi === 0 ? new Date(lead.created_at).toLocaleDateString() : ''}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                {fi === 0 && (
                                  lead.synced_to_crm ? (
                                    <CheckCircle2 size={16} style={{ color: '#16a34a' }} />
                                  ) : (
                                    <button onClick={() => handleSyncToCrm(lead.leadgen_id)} disabled={actionLoading} title="Sync to CRM" style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-light)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                      <ArrowRight size={14} style={{ color: '#1877F2' }} />
                                    </button>
                                  )
                                )}
                              </td>
                            </tr>
                          ));
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
