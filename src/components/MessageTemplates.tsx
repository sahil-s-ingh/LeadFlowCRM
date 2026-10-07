import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import {
  ArrowLeft, Loader2, RefreshCw, Plus, Send, Trash2, Pencil,
  FileText as FileTextIcon, AlertTriangle, Link2, Phone, MessageSquare,
  CheckCircle2, XCircle, Clock,
} from 'lucide-react';

type WaTemplate = {
  meta_template_id: string | null;
  name: string;
  language: string;
  category: string;
  status: string;
  components: any[];
  rejection_reason: string | null;
};

type TplButton = { type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'; text: string; url?: string; phone?: string };

export default function MessageTemplates({ session, onBack, embedded }: { session: Session; onBack: () => void; embedded?: boolean }) {
  const [waTemplates, setWaTemplates] = useState<WaTemplate[]>([]);
  const [waTemplatesLoading, setWaTemplatesLoading] = useState(false);
  const [waTemplateError, setWaTemplateError] = useState('');
  const [showWaTemplateForm, setShowWaTemplateForm] = useState(false);
  const [tplName, setTplName] = useState('');
  const [tplLanguage, setTplLanguage] = useState('en_US');
  const [tplCategory, setTplCategory] = useState('MARKETING');
  const [tplBody, setTplBody] = useState('');
  const [tplFooter, setTplFooter] = useState('');
  const [tplCreating, setTplCreating] = useState(false);
  const [tplHeader, setTplHeader] = useState('');
  const [tplBodyExample, setTplBodyExample] = useState('');
  const [tplHeaderExample, setTplHeaderExample] = useState('');
  const [tplButtons, setTplButtons] = useState<TplButton[]>([]);
  const [tplEditingId, setTplEditingId] = useState<string | null>(null);
  const [tplSyncingId, setTplSyncingId] = useState<string | null>(null);

  useEffect(() => {
    fetchWaTemplates();
  }, []);

  const fetchWaTemplates = async () => {
    setWaTemplatesLoading(true);
    setWaTemplateError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-templates?action=list`;
      const res = await fetch(apiUrl, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok || data.error) {
        setWaTemplateError(data.error || 'Failed to load templates');
        return;
      }
      setWaTemplates(data.templates || []);
    } catch {
      setWaTemplateError('Failed to load templates');
    } finally {
      setWaTemplatesLoading(false);
    }
  };

  const resetTplForm = () => {
    setTplName('');
    setTplBody('');
    setTplFooter('');
    setTplHeader('');
    setTplBodyExample('');
    setTplHeaderExample('');
    setTplButtons([]);
    setTplCategory('MARKETING');
    setTplLanguage('en_US');
    setTplEditingId(null);
  };

  const buildTemplateComponents = () => {
    const components: any[] = [];
    if (tplHeader.trim()) {
      const headerComp: any = { type: 'HEADER', format: 'TEXT', text: tplHeader.trim() };
      if (/\{\{1\}\}/.test(tplHeader) && tplHeaderExample.trim()) {
        headerComp.example = { header_text: [tplHeaderExample.trim()] };
      }
      components.push(headerComp);
    }
    const bodyComp: any = { type: 'BODY', text: tplBody.trim() };
    const varCount = (tplBody.match(/\{\{\d+\}\}/g) || []).length;
    if (varCount > 0 && tplBodyExample.trim()) {
      const examples = tplBodyExample.split(',').map((s) => s.trim()).filter(Boolean);
      if (examples.length > 0) {
        bodyComp.example = { body_text: [examples] };
      }
    }
    components.push(bodyComp);
    if (tplFooter.trim()) {
      components.push({ type: 'FOOTER', text: tplFooter.trim() });
    }
    if (tplButtons.length > 0) {
      components.push({
        type: 'BUTTONS',
        buttons: tplButtons.map((b) => {
          if (b.type === 'QUICK_REPLY') return { type: 'QUICK_REPLY', text: b.text };
          if (b.type === 'URL') return { type: 'URL', text: b.text, url: b.url || '' };
          return { type: 'PHONE_NUMBER', text: b.text, phone_number: b.phone || '' };
        }),
      });
    }
    return components;
  };

  const sanitizeTemplateName = (raw: string) =>
    raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

  const validateTemplateForm = (): string | null => {
    const sanitizedName = sanitizeTemplateName(tplName);
    if (!sanitizedName) return 'Template name is required';
    if (sanitizedName.length < 5) return 'Template name must be at least 5 characters long';
    if (sanitizedName.length > 60) return 'Template name must be 60 characters or fewer';
    if (!tplBody.trim()) return 'Body text is required';
    if (tplBody.length > 1024) return 'Body text must be 1024 characters or fewer';

    // Validate body variables are sequential starting from 1
    const bodyVars = (tplBody.match(/\{\{(\d+)\}\}/g) || []).map((m) => parseInt(m.match(/\d+/)![0], 10));
    if (bodyVars.length > 0) {
      const uniqueVars = [...new Set(bodyVars)].sort((a, b) => a - b);
      for (let i = 0; i < uniqueVars.length; i++) {
        if (uniqueVars[i] !== i + 1)
          return `Body variables must be sequential starting from {{1}}. Found {{${uniqueVars[i]}}} but expected {{${i + 1}}}.`;
      }
      if (!tplBodyExample.trim())
        return 'Body has variables but no example values were provided. Meta requires example values for all variables.';
      const examples = tplBodyExample.split(',').map((s) => s.trim()).filter(Boolean);
      if (examples.length !== uniqueVars.length)
        return `Body has ${uniqueVars.length} variable(s) but ${examples.length} example value(s) were provided. Provide exactly ${uniqueVars.length} comma-separated example value(s).`;
    }

    // Validate header variable
    if (tplHeader.trim() && /\{\{1\}\}/.test(tplHeader) && !tplHeaderExample.trim())
      return 'Header has a variable but no example value was provided. Meta requires an example value.';

    // Validate buttons
    for (const [i, btn] of tplButtons.entries()) {
      if (!btn.text.trim()) return `Button ${i + 1} is missing a label`;
      if (btn.type === 'URL' && !btn.url?.trim()) return `Button ${i + 1} (URL) is missing a URL`;
      if (btn.type === 'PHONE_NUMBER' && !btn.phone?.trim()) return `Button ${i + 1} (Phone) is missing a phone number`;
      // URL buttons can only have {{1}} variable
      if (btn.type === 'URL' && btn.url) {
        const urlVars = (btn.url.match(/\{\{(\d+)\}\}/g) || []).map((m) => parseInt(m.match(/\d+/)![0], 10));
        if (urlVars.some((v) => v !== 1))
          return `Button ${i + 1} (URL) can only use {{1}} as a variable.`;
      }
    }
    return null;
  };

  const handleCreateWaTemplate = async () => {
    const validationError = validateTemplateForm();
    if (validationError) { setWaTemplateError(validationError); return; }
    setTplCreating(true);
    setWaTemplateError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const components = buildTemplateComponents();
      const action = tplEditingId ? 'edit' : 'create';
      const sanitizedName = sanitizeTemplateName(tplName);
      const reqBody: any = { name: sanitizedName, language: tplLanguage, category: tplCategory, components };
      if (tplEditingId) {
        reqBody.meta_template_id = tplEditingId;
      }
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-templates?action=${action}`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(reqBody),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setWaTemplateError(data.error || 'Failed to save template');
        return;
      }
      setShowWaTemplateForm(false);
      resetTplForm();
      await fetchWaTemplates();
    } catch {
      setWaTemplateError('Failed to save template');
    } finally {
      setTplCreating(false);
    }
  };

  const handleEditWaTemplate = (tpl: WaTemplate) => {
    setTplEditingId(tpl.meta_template_id);
    setTplName(tpl.name);
    setTplLanguage(tpl.language);
    setTplCategory(tpl.category);
    const bodyComp = tpl.components?.find((c: any) => c.type === 'BODY');
    const headerComp = tpl.components?.find((c: any) => c.type === 'HEADER');
    const footerComp = tpl.components?.find((c: any) => c.type === 'FOOTER');
    const buttonsComp = tpl.components?.find((c: any) => c.type === 'BUTTONS');
    setTplBody(bodyComp?.text || '');
    setTplHeader(headerComp?.text || '');
    setTplFooter(footerComp?.text || '');
    if (bodyComp?.example?.body_text) {
      setTplBodyExample(bodyComp.example.body_text[0].join(', '));
    } else {
      setTplBodyExample('');
    }
    if (headerComp?.example?.header_text) {
      setTplHeaderExample(headerComp.example.header_text[0]);
    } else {
      setTplHeaderExample('');
    }
    if (buttonsComp?.buttons) {
      setTplButtons(buttonsComp.buttons.map((b: any) => ({
        type: b.type,
        text: b.text || '',
        url: b.url || '',
        phone: b.phone_number || '',
      })));
    } else {
      setTplButtons([]);
    }
    setShowWaTemplateForm(true);
  };

  const handleSyncWaTemplate = async (metaTemplateId: string) => {
    setTplSyncingId(metaTemplateId);
    setWaTemplateError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-templates?action=sync&meta_template_id=${metaTemplateId}`;
      const res = await fetch(apiUrl, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok || data.error) {
        setWaTemplateError(data.error || 'Failed to sync template');
        return;
      }
      await fetchWaTemplates();
    } catch {
      setWaTemplateError('Failed to sync template');
    } finally {
      setTplSyncingId(null);
    }
  };

  const handleDeleteWaTemplate = async (tpl: WaTemplate) => {
    if (!confirm('Delete this template from Meta? This cannot be undone.')) return;
    setWaTemplateError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-templates?action=delete`;
      const res = await fetch(apiUrl, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ meta_template_id: tpl.meta_template_id, name: tpl.name }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setWaTemplateError(data.error || 'Failed to delete template');
        return;
      }
      setWaTemplates((prev) => prev.filter((t) => t.meta_template_id !== tpl.meta_template_id));
      await fetchWaTemplates();
    } catch {
      setWaTemplateError('Failed to delete template');
    }
  };

  const approvedCount = waTemplates.filter((t) => t.status === 'APPROVED').length;
  const pendingCount = waTemplates.filter((t) => t.status === 'PENDING').length;
  const rejectedCount = waTemplates.filter((t) => t.status === 'REJECTED').length;

  const statusConfig: Record<string, { bg: string; color: string; icon: React.ReactNode }> = {
    APPROVED: { bg: 'rgba(22,163,74,0.12)', color: '#16a34a', icon: <CheckCircle2 size={12} /> },
    PENDING: { bg: 'rgba(245,158,11,0.12)', color: '#d97706', icon: <Clock size={12} /> },
    REJECTED: { bg: 'rgba(239,68,68,0.12)', color: '#dc2626', icon: <XCircle size={12} /> },
  };

  const categoryConfig: Record<string, { color: string; bg: string }> = {
    MARKETING: { color: '#C2410C', bg: 'rgba(194, 65, 12, 0.1)' },
    UTILITY: { color: '#0891B2', bg: 'rgba(8, 145, 178, 0.1)' },
    AUTHENTICATION: { color: '#DC2626', bg: 'rgba(220, 38, 38, 0.1)' },
  };

  const renderPreview = (header?: string, body?: string, footer?: string, buttons?: any[]) => (
    <div className="mt-wa-preview">
      <div className="mt-wa-preview-header">
        <div className="mt-wa-preview-avatar"><MessageSquare size={14} /></div>
        <span>Business</span>
      </div>
      {header && <div className="mt-wa-preview-title">{header}</div>}
      {body && <div className="mt-wa-preview-body">{body}</div>}
      {footer && <div className="mt-wa-preview-footer">{footer}</div>}
      {buttons && buttons.length > 0 && (
        <div className="mt-wa-preview-buttons">
          {buttons.map((b: any, bi: number) => (
            <div key={bi} className="mt-wa-preview-btn">
              {b.type === 'URL' && <Link2 size={11} />}
              {b.type === 'PHONE_NUMBER' && <Phone size={11} />}
              {b.type === 'QUICK_REPLY' && <MessageSquare size={11} />}
              {b.text}
            </div>
          ))}
        </div>
      )}
      <div className="mt-wa-preview-tail" />
    </div>
  );

  return (
    <div className="mt-container">
      {/* Header */}
      <div className="mt-header">
        <div className="mt-header-left">
          {!embedded && (
            <button className="mt-back-btn" onClick={onBack} aria-label="Back to dashboard">
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <h1 className="mt-title">WhatsApp Templates</h1>
            <p className="mt-subtitle">Create and manage WhatsApp message templates approved by Meta</p>
          </div>
        </div>
        <div className="mt-header-actions">
          <button className="mt-refresh-btn" onClick={fetchWaTemplates} disabled={waTemplatesLoading}>
            {waTemplatesLoading ? <Loader2 size={16} className="crm-spin" /> : <RefreshCw size={16} />}
            Refresh
          </button>
          {!showWaTemplateForm && (
            <button className="mt-new-btn" onClick={() => { if (tplEditingId) resetTplForm(); setShowWaTemplateForm(true); }}>
              <Plus size={16} /> New Template
            </button>
          )}
        </div>
      </div>

      {waTemplateError && (
        <div className="mt-error-banner">
          <AlertTriangle size={16} /> {waTemplateError}
        </div>
      )}

      {/* Stats Cards */}
      <div className="mt-stats-grid">
        {[
          { icon: <FileTextIcon size={22} />, value: waTemplates.length, label: 'Total Templates', color: 'green' },
          { icon: <CheckCircle2 size={22} />, value: approvedCount, label: 'Approved', color: 'emerald' },
          { icon: <Clock size={22} />, value: pendingCount, label: 'Pending Review', color: 'amber' },
          { icon: <XCircle size={22} />, value: rejectedCount, label: 'Rejected', color: 'red' },
        ].map((card, i) => (
          <div key={i} className={`mt-stat-card mt-stat-${card.color}`}>
            <div className="mt-stat-glow" />
            <div className="mt-stat-top">
              <div className="mt-stat-icon-wrap">{card.icon}</div>
            </div>
            <span className="mt-stat-value">{card.value}</span>
            <span className="mt-stat-label">{card.label}</span>
          </div>
        ))}
      </div>

      {/* Form */}
      {showWaTemplateForm && (
        <div className="mt-card mt-card-elevated mt-form-card">
          <div className="mt-card-header">
            <div className="mt-card-title">
              <div className="mt-card-icon mt-card-icon-green">
                {tplEditingId ? <Pencil size={18} /> : <Plus size={18} />}
              </div>
              <h2>{tplEditingId ? 'Edit Template' : 'Create New Template'}</h2>
            </div>
            <button className="mt-cancel-link" onClick={() => { setShowWaTemplateForm(false); resetTplForm(); }}>
              <ArrowLeft size={14} /> Cancel
            </button>
          </div>

          <div className="mt-form-body">
            <div className="mt-form-grid">
              <label className="mt-field mt-field-full">
                <span>Template Name <em>*</em></span>
                <input type="text" value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="order_confirmation" className="mt-input mt-input-mono" disabled={!!tplEditingId} />
                <small className="mt-field-hint">
                  Lowercase letters and underscores only. No spaces. {tplEditingId ? '(Cannot be changed when editing)' : ''}
                </small>
              </label>
              <label className="mt-field">
                <span>Language <em>*</em></span>
                <select value={tplLanguage} onChange={(e) => setTplLanguage(e.target.value)} className="mt-select" disabled={!!tplEditingId}>
                  <option value="en_US">English (US)</option>
                  <option value="en">English</option>
                  <option value="en_GB">English (UK)</option>
                  <option value="hi">Hindi</option>
                  <option value="ta">Tamil</option>
                  <option value="te">Telugu</option>
                  <option value="bn">Bengali</option>
                  <option value="mr">Marathi</option>
                  <option value="gu">Gujarati</option>
                  <option value="kn">Kannada</option>
                  <option value="ml">Malayalam</option>
                  <option value="pa">Punjabi</option>
                  <option value="es">Spanish</option>
                  <option value="pt_BR">Portuguese (BR)</option>
                  <option value="ar_AR">Arabic</option>
                  <option value="fr_FR">French</option>
                  <option value="de_DE">German</option>
                  <option value="id">Indonesian</option>
                  <option value="it">Italian</option>
                  <option value="ja">Japanese</option>
                  <option value="ko">Korean</option>
                  <option value="ru">Russian</option>
                  <option value="th">Thai</option>
                  <option value="tr">Turkish</option>
                  <option value="vi">Vietnamese</option>
                  <option value="zh_CN">Chinese (Simplified)</option>
                  <option value="zh_TW">Chinese (Traditional)</option>
                </select>
              </label>
              <label className="mt-field">
                <span>Category <em>*</em></span>
                <select value={tplCategory} onChange={(e) => setTplCategory(e.target.value)} className="mt-select">
                  <option value="MARKETING">Marketing</option>
                  <option value="UTILITY">Utility</option>
                  <option value="AUTHENTICATION">Authentication</option>
                </select>
              </label>
              <label className="mt-field mt-field-full">
                <span>Header Text (optional)</span>
                <input type="text" value={tplHeader} onChange={(e) => setTplHeader(e.target.value)} placeholder="Order Confirmation" maxLength={60} className="mt-input" />
                <small className="mt-field-hint">Optional text header shown above the body. Max 60 characters. Supports 1 variable: {'{{1}}'}.</small>
              </label>
              {tplHeader.trim() && /\{\{1\}\}/.test(tplHeader) && (
                <label className="mt-field mt-field-full">
                  <span>Header Example Value</span>
                  <input type="text" value={tplHeaderExample} onChange={(e) => setTplHeaderExample(e.target.value)} placeholder="December 1st" className="mt-input" />
                  <small className="mt-field-hint mt-field-hint-error">Required when header contains a variable. Meta will reject without it.</small>
                </label>
              )}
              <label className="mt-field mt-field-full">
                <span>Body Text <em>*</em></span>
                <textarea value={tplBody} onChange={(e) => setTplBody(e.target.value)} rows={4} placeholder="Hi {{1}}, your order {{2}} has been confirmed." className="mt-textarea" />
                <small className="mt-field-hint">Use {'{{1}}'}, {'{{2}}'} etc. for variable placeholders.</small>
              </label>
              {(tplBody.match(/\{\{\d+\}\}/g) || []).length > 0 && (
                <label className="mt-field mt-field-full">
                  <span>Body Example Values</span>
                  <input type="text" value={tplBodyExample} onChange={(e) => setTplBodyExample(e.target.value)} placeholder="John, ORDER123" className="mt-input" />
                  <small className="mt-field-hint mt-field-hint-error">Required when body has variables. Comma-separated, one per variable. Meta will reject without these.</small>
                </label>
              )}
              <label className="mt-field mt-field-full">
                <span>Footer (optional)</span>
                <input type="text" value={tplFooter} onChange={(e) => setTplFooter(e.target.value)} placeholder="Reply STOP to unsubscribe" maxLength={60} className="mt-input" />
              </label>
            </div>

            {/* Buttons */}
            <div className="mt-buttons-section">
              <div className="mt-buttons-label">Buttons (optional, max 10)</div>
              {tplButtons.map((btn, idx) => (
                <div key={idx} className="mt-button-row">
                  <select
                    value={btn.type}
                    onChange={(e) => {
                      const newBtns = [...tplButtons];
                      newBtns[idx] = { ...btn, type: e.target.value as 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' };
                      setTplButtons(newBtns);
                    }}
                    className="mt-btn-type-select"
                  >
                    <option value="QUICK_REPLY">Quick Reply</option>
                    <option value="URL">URL</option>
                    <option value="PHONE_NUMBER">Phone</option>
                  </select>
                  <input
                    type="text"
                    value={btn.text}
                    onChange={(e) => {
                      const newBtns = [...tplButtons];
                      newBtns[idx] = { ...btn, text: e.target.value };
                      setTplButtons(newBtns);
                    }}
                    placeholder="Button label (25 char max)"
                    maxLength={25}
                    className="mt-btn-text-input"
                  />
                  {btn.type === 'URL' && (
                    <input
                      type="text"
                      value={btn.url || ''}
                      onChange={(e) => {
                        const newBtns = [...tplButtons];
                        newBtns[idx] = { ...btn, url: e.target.value };
                        setTplButtons(newBtns);
                      }}
                      placeholder="https://example.com/{{1}}"
                      className="mt-btn-text-input"
                    />
                  )}
                  {btn.type === 'PHONE_NUMBER' && (
                    <input
                      type="text"
                      value={btn.phone || ''}
                      onChange={(e) => {
                        const newBtns = [...tplButtons];
                        newBtns[idx] = { ...btn, phone: e.target.value };
                        setTplButtons(newBtns);
                      }}
                      placeholder="+1234567890"
                      className="mt-btn-text-input"
                    />
                  )}
                  <button type="button" onClick={() => setTplButtons(tplButtons.filter((_, i) => i !== idx))} className="mt-btn-remove">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {tplButtons.length < 10 && (
                <button type="button" onClick={() => setTplButtons([...tplButtons, { type: 'QUICK_REPLY', text: '' }])} className="mt-btn-add">
                  <Plus size={12} /> Add Button
                </button>
              )}
            </div>

            <div className="mt-form-actions">
              <button
                type="button"
                onClick={handleCreateWaTemplate}
                disabled={!tplName.trim() || !tplBody.trim() || tplCreating}
                className="mt-submit-btn"
              >
                {tplCreating ? <Loader2 size={14} className="crm-spin" /> : <Send size={14} />}
                {tplEditingId ? 'Update Template' : 'Submit for Review'}
              </button>
              <button type="button" onClick={() => { setShowWaTemplateForm(false); resetTplForm(); }} className="mt-cancel-btn">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Cards Grid */}
      {!showWaTemplateForm && (
      <div className="mt-card mt-card-elevated">
        <div className="mt-card-header">
          <div className="mt-card-title">
            <div className="mt-card-icon mt-card-icon-green"><FileTextIcon size={18} /></div>
            <h2>Templates</h2>
            <span className="mt-log-count">{waTemplates.length}</span>
          </div>
        </div>

        {waTemplatesLoading ? (
          <div className="mt-loading-state">
            <Loader2 size={28} className="crm-spin" style={{ color: '#25D366' }} />
            <p>Loading templates...</p>
          </div>
        ) : waTemplates.length === 0 ? (
          <div className="mt-empty-state">
            <FileTextIcon size={40} style={{ opacity: 0.25, marginBottom: 10 }} />
            <h3>No templates yet</h3>
            <p>Click "New Template" to create one, or "Refresh" to sync from Meta.</p>
          </div>
        ) : (
          <div className="mt-card-grid">
            {waTemplates.map((tpl) => {
              const sc = statusConfig[tpl.status] || statusConfig.PENDING;
              const cat = categoryConfig[tpl.category] || categoryConfig.UTILITY;
              const headerComp = tpl.components?.find((c: any) => c.type === 'HEADER');
              const bodyComp = tpl.components?.find((c: any) => c.type === 'BODY');
              const footerComp = tpl.components?.find((c: any) => c.type === 'FOOTER');
              const buttonsComp = tpl.components?.find((c: any) => c.type === 'BUTTONS');
              return (
                <div key={tpl.meta_template_id || tpl.name} className="mt-tpl-card">
                  <div className="mt-tpl-card-top">
                    <div className="mt-tpl-card-name-row">
                      <strong className="mt-tpl-card-name">{tpl.name}</strong>
                      <span className="mt-tpl-card-cat" style={{ background: cat.bg, color: cat.color }}>{tpl.category}</span>
                    </div>
                    <div className="mt-tpl-card-meta-row">
                      <span className="mt-status-pill" style={{ background: sc.bg, color: sc.color }}>{sc.icon} {tpl.status}</span>
                      <span className="mt-tpl-card-lang">{tpl.language}</span>
                    </div>
                  </div>
                  <div className="mt-tpl-card-preview">
                    {renderPreview(headerComp?.text, bodyComp?.text, footerComp?.text, buttonsComp?.buttons)}
                  </div>
                  {tpl.rejection_reason && (
                    <p className="mt-tpl-card-rejection">Rejection: {tpl.rejection_reason}</p>
                  )}
                  <div className="mt-tpl-card-footer">
                    {tpl.meta_template_id && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleSyncWaTemplate(tpl.meta_template_id!)}
                          disabled={tplSyncingId === tpl.meta_template_id}
                          className="mt-action-btn mt-action-btn-ghost"
                          title="Sync status from Meta"
                        >
                          {tplSyncingId === tpl.meta_template_id ? <Loader2 size={11} className="crm-spin" /> : <RefreshCw size={11} />}
                          Sync
                        </button>
                        <button type="button" onClick={() => handleEditWaTemplate(tpl)} className="mt-action-btn mt-action-btn-edit">
                          <Pencil size={11} /> Edit
                        </button>
                        <button type="button" onClick={() => handleDeleteWaTemplate(tpl)} className="mt-action-btn mt-action-btn-danger">
                          <Trash2 size={11} /> Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
