import { useState } from 'react';
import {
  MousePointerClick, Plus, Trash2, ArrowUp, ArrowDown,
  Save, Loader2, CheckCircle2, AlertTriangle, Eye, Pencil,
  Type, Mail, Phone, ListChecks, AlignLeft, Hash, CheckSquare,
  Radio, Calendar, Link, Copy,
} from 'lucide-react';
import type { PopupFormField, PopupFormRow } from './CrmDashboard';

type Props = {
  forms: PopupFormRow[];
  editingForm: PopupFormRow | null;
  saving: boolean;
  saved: boolean;
  error: string;
  onSave: (formData: Partial<PopupFormRow>) => void;
  onEdit: (form: PopupFormRow) => void;
  onCancelEdit: () => void;
  onToggleActive: (form: PopupFormRow) => void;
  onDelete: (id: string) => void;
};

const FIELD_TYPES: { type: PopupFormField['type']; label: string; icon: React.ReactNode }[] = [
  { type: 'text', label: 'Text', icon: <Type size={16} /> },
  { type: 'email', label: 'Email', icon: <Mail size={16} /> },
  { type: 'tel', label: 'Phone', icon: <Phone size={16} /> },
  { type: 'number', label: 'Number', icon: <Hash size={16} /> },
  { type: 'select', label: 'Dropdown', icon: <ListChecks size={16} /> },
  { type: 'radio', label: 'Radio', icon: <Radio size={16} /> },
  { type: 'textarea', label: 'Long Text', icon: <AlignLeft size={16} /> },
  { type: 'checkbox', label: 'Checkbox', icon: <CheckSquare size={16} /> },
  { type: 'date', label: 'Date', icon: <Calendar size={16} /> },
  { type: 'url', label: 'URL', icon: <Link size={16} /> },
];

const MAP_OPTIONS: { value: PopupFormField['mapsTo']; label: string }[] = [
  { value: 'full_name', label: 'Full Name' },
  { value: 'mobile_number', label: 'Mobile Number' },
  { value: 'email', label: 'Email' },
  { value: 'state', label: 'State' },
  { value: 'trading_product', label: 'Trading Product' },
  { value: 'fund_amount', label: 'Fund Amount' },
  { value: 'custom', label: 'Custom (stored as extra data)' },
];

const TRIGGER_OPTIONS: { value: PopupFormRow['trigger_type']; label: string; desc: string }[] = [
  { value: 'time_delay', label: 'Time Delay', desc: 'Show after X seconds on page' },
  { value: 'scroll', label: 'Scroll %', desc: 'Show when user scrolls X% of page' },
  { value: 'exit_intent', label: 'Exit Intent', desc: 'Show when mouse leaves the page' },
  { value: 'immediate', label: 'Immediate', desc: 'Show as soon as page loads' },
];

const POSITION_OPTIONS: { value: PopupFormRow['popup_position']; label: string }[] = [
  { value: 'center', label: 'Center' },
  { value: 'bottom_left', label: 'Bottom Left' },
  { value: 'bottom_right', label: 'Bottom Right' },
];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export default function PopupFormBuilderPanel({
  forms, editingForm, saving, saved, error,
  onSave, onEdit, onCancelEdit, onToggleActive, onDelete,
}: Props) {
  const [name, setName] = useState(editingForm?.name || '');
  const [title, setTitle] = useState(editingForm?.title || 'Get Free Access');
  const [subtitle, setSubtitle] = useState(editingForm?.subtitle || 'Fill in your details to continue');
  const [description, setDescription] = useState(editingForm?.description || '');
  const [imageUrl, setImageUrl] = useState(editingForm?.image_url || '');
  const [fields, setFields] = useState<PopupFormField[]>(editingForm?.fields || []);
  const [triggerType, setTriggerType] = useState<PopupFormRow['trigger_type']>(editingForm?.trigger_type || 'time_delay');
  const [triggerValue, setTriggerValue] = useState(editingForm?.trigger_value ?? 5);
  const [buttonText, setButtonText] = useState(editingForm?.button_text || 'Submit');
  const [buttonBgColor, setButtonBgColor] = useState(editingForm?.button_bg_color || '#0f766e');
  const [buttonTextColor, setButtonTextColor] = useState(editingForm?.button_text_color || '#ffffff');
  const [isActive, setIsActive] = useState(editingForm?.is_active ?? false);
  const [showPreview, setShowPreview] = useState(false);
  const [successMessage, setSuccessMessage] = useState(editingForm?.success_message || '');
  const [showOnce, setShowOnce] = useState(editingForm?.show_once ?? false);
  const [overlayColor, setOverlayColor] = useState(editingForm?.overlay_color || '#000000');
  const [overlayOpacity, setOverlayOpacity] = useState(55);
  const [popupPosition, setPopupPosition] = useState<PopupFormRow['popup_position']>(editingForm?.popup_position || 'center');
  const [autoCloseDelay, setAutoCloseDelay] = useState(editingForm?.auto_close_delay ?? 0);

  const addField = (type: PopupFormField['type']) => {
    const newField: PopupFormField = {
      id: uid(),
      type,
      label: '',
      placeholder: '',
      required: false,
      options: (type === 'select' || type === 'radio') ? ['Option 1'] : [],
      mapsTo: 'custom',
      default_value: '',
      width: 'full',
    };
    setFields((prev) => [...prev, newField]);
  };

  const updateField = (id: string, updates: Partial<PopupFormField>) => {
    setFields((prev) => prev.map((f) => f.id === id ? { ...f, ...updates } : f));
  };

  const removeField = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
  };

  const duplicateField = (index: number) => {
    setFields((prev) => {
      const field = prev[index];
      const copy: PopupFormField = { ...field, id: uid(), label: field.label + ' (copy)' };
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
  };

  const moveField = (index: number, dir: 'up' | 'down') => {
    setFields((prev) => {
      const next = [...prev];
      const target = dir === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleSaveForm = () => {
    onSave({
      id: editingForm?.id,
      name: name.trim() || 'Untitled Form',
      title: title.trim(),
      subtitle: subtitle.trim(),
      description: description.trim(),
      image_url: imageUrl.trim(),
      fields,
      trigger_type: triggerType,
      trigger_value: triggerValue,
      button_text: buttonText.trim() || 'Submit',
      button_bg_color: buttonBgColor,
      button_text_color: buttonTextColor,
      is_active: isActive,
      success_message: successMessage.trim(),
      show_once: showOnce,
      overlay_color: overlayColor,
      popup_position: popupPosition,
      auto_close_delay: autoCloseDelay,
    });
    if (!editingForm) {
      setName('');
      setTitle('Get Free Access');
      setSubtitle('Fill in your details to continue');
      setDescription('');
      setImageUrl('');
      setFields([]);
      setTriggerType('time_delay');
      setTriggerValue(5);
      setButtonText('Submit');
      setButtonBgColor('#0f766e');
      setButtonTextColor('#ffffff');
      setIsActive(false);
      setSuccessMessage('');
      setShowOnce(false);
      setOverlayColor('#000000');
      setOverlayOpacity(55);
      setPopupPosition('center');
      setAutoCloseDelay(0);
    }
  };

  const overlayRgba = () => {
    const hex = overlayColor.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16) || 0;
    const g = parseInt(hex.slice(2, 4), 16) || 0;
    const b = parseInt(hex.slice(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${overlayOpacity / 100})`;
  };

  if (editingForm || (!editingForm && forms.length === 0 && !saved)) {
    return (
      <>
        <div className="crm-settings-card-header">
          <h2 className="crm-settings-card-title">
            <MousePointerClick size={20} style={{ color: '#7c3aed' }} />
            {editingForm ? 'Edit Popup Form' : 'Create Popup Form'}
          </h2>
          <p className="crm-settings-card-desc">
            Build a custom popup form for your landing page. Submissions flow directly into your leads table.
          </p>
        </div>

        {editingForm && (
          <div style={{ marginBottom: '16px' }}>
            <button
              type="button"
              onClick={onCancelEdit}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}
            >
              <ArrowUp size={14} /> Back to forms list
            </button>
          </div>
        )}

        {/* Basic Settings */}
        <div style={{ background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '16px', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Form Details</h3>
          <div className="crm-add-lead-grid">
            <label className="crm-add-lead-field" style={{ gridColumn: '1 / -1' }}>
              <span>Form Name (internal) <em>*</em></span>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Webinar Signup Form" />
            </label>
            <label className="crm-add-lead-field">
              <span>Popup Title</span>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Get Free Access" />
            </label>
            <label className="crm-add-lead-field">
              <span>Popup Subtitle</span>
              <input type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Fill in your details to continue" />
            </label>
            <label className="crm-add-lead-field" style={{ gridColumn: '1 / -1' }}>
              <span>Description / Help Text (optional)</span>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Additional text shown under the subtitle" rows={2} style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px', fontSize: '0.85rem', fontFamily: 'inherit' }} />
            </label>
            <label className="crm-add-lead-field" style={{ gridColumn: '1 / -1' }}>
              <span>Image / Logo URL (optional)</span>
              <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://example.com/logo.png" />
            </label>
          </div>
        </div>

        {/* Trigger Settings */}
        <div style={{ background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '16px', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>When to Show</h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
            {TRIGGER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTriggerType(opt.value)}
                style={{
                  padding: '10px 14px', borderRadius: '8px', border: triggerType === opt.value ? '2px solid #7c3aed' : '1px solid #e2e8f0',
                  background: triggerType === opt.value ? 'rgba(124,58,237,0.06)' : '#fff', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', flex: '1', minWidth: '120px', transition: 'all 0.15s',
                }}
              >
                <strong style={{ fontSize: '0.82rem', color: triggerType === opt.value ? '#7c3aed' : '#1e293b' }}>{opt.label}</strong>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{opt.desc}</span>
              </button>
            ))}
          </div>
          {(triggerType === 'time_delay' || triggerType === 'scroll') && (
            <label className="crm-add-lead-field" style={{ maxWidth: '200px' }}>
              <span>{triggerType === 'time_delay' ? 'Delay (seconds)' : 'Scroll Percentage'}</span>
              <input type="number" min={triggerType === 'time_delay' ? 0 : 10} max={triggerType === 'time_delay' ? 120 : 90} value={triggerValue} onChange={(e) => setTriggerValue(parseInt(e.target.value) || 0)} />
            </label>
          )}
          <label className="crm-add-lead-field" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
            <input type="checkbox" checked={showOnce} onChange={(e) => setShowOnce(e.target.checked)} />
            <span>Show only once per visitor (persists across browser sessions)</span>
          </label>
        </div>

        {/* Field Builder */}
        <div style={{ background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Form Fields</h3>
            <button type="button" onClick={() => setShowPreview(!showPreview)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, color: '#475569' }}>
              <Eye size={14} /> {showPreview ? 'Hide Preview' : 'Preview'}
            </button>
          </div>

          {/* Add field buttons */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {FIELD_TYPES.map((ft) => (
              <button key={ft.type} type="button" onClick={() => addField(ft.type)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, color: '#475569', transition: 'all 0.15s' }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#7c3aed'; e.currentTarget.style.color = '#7c3aed'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#475569'; }}>
                {ft.icon} {ft.label}
              </button>
            ))}
          </div>

          {/* Field list */}
          {fields.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: '#94a3b8', fontSize: '0.85rem', border: '2px dashed #e2e8f0', borderRadius: '10px' }}>
              No fields yet. Click a field type above to add one.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {fields.map((field, index) => (
                <div key={field.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>{index + 1}.</span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', textTransform: 'capitalize' }}>{field.type}</span>
                      {field.width === 'half' && (
                        <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(124,58,237,0.1)', color: '#7c3aed', fontWeight: 600 }}>half</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button type="button" onClick={() => moveField(index, 'up')} disabled={index === 0} style={{ border: 'none', background: 'none', cursor: index === 0 ? 'not-allowed' : 'pointer', color: index === 0 ? '#cbd5e1' : '#64748b', padding: '4px' }}><ArrowUp size={15} /></button>
                      <button type="button" onClick={() => moveField(index, 'down')} disabled={index === fields.length - 1} style={{ border: 'none', background: 'none', cursor: index === fields.length - 1 ? 'not-allowed' : 'pointer', color: index === fields.length - 1 ? '#cbd5e1' : '#64748b', padding: '4px' }}><ArrowDown size={15} /></button>
                      <button type="button" onClick={() => duplicateField(index)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#6366f1', padding: '4px' }} title="Duplicate field"><Copy size={14} /></button>
                      <button type="button" onClick={() => removeField(field.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}><Trash2 size={15} /></button>
                    </div>
                  </div>
                  <div className="crm-add-lead-grid">
                    <label className="crm-add-lead-field">
                      <span>Label</span>
                      <input type="text" value={field.label} onChange={(e) => updateField(field.id, { label: e.target.value })} placeholder="e.g. Full Name" />
                    </label>
                    <label className="crm-add-lead-field">
                      <span>Placeholder</span>
                      <input type="text" value={field.placeholder} onChange={(e) => updateField(field.id, { placeholder: e.target.value })} placeholder="e.g. Enter your name" />
                    </label>
                    <label className="crm-add-lead-field">
                      <span>Maps to Lead Field</span>
                      <select value={field.mapsTo} onChange={(e) => updateField(field.id, { mapsTo: e.target.value as PopupFormField['mapsTo'] })}>
                        {MAP_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                    </label>
                    <label className="crm-add-lead-field">
                      <span>Field Width</span>
                      <select value={field.width || 'full'} onChange={(e) => updateField(field.id, { width: e.target.value as 'full' | 'half' })}>
                        <option value="full">Full Width</option>
                        <option value="half">Half Width</option>
                      </select>
                    </label>
                    <label className="crm-add-lead-field">
                      <span>Default Value (optional)</span>
                      <input type="text" value={field.default_value || ''} onChange={(e) => updateField(field.id, { default_value: e.target.value })} placeholder="Pre-fill this field" />
                    </label>
                    <label className="crm-add-lead-field" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                      <input type="checkbox" checked={field.required} onChange={(e) => updateField(field.id, { required: e.target.checked })} />
                      <span>Required</span>
                    </label>
                  </div>
                  {(field.type === 'select' || field.type === 'radio') && (
                    <label className="crm-add-lead-field" style={{ marginTop: '8px' }}>
                      <span>Options (one per line)</span>
                      <textarea value={field.options.join('\n')} onChange={(e) => updateField(field.id, { options: e.target.value.split('\n').filter(Boolean) })} rows={3} style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px', fontSize: '0.85rem', fontFamily: 'inherit' }} />
                    </label>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Button & Appearance */}
        <div style={{ background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '16px', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Button & Appearance</h3>
          <div className="crm-add-lead-grid">
            <label className="crm-add-lead-field">
              <span>Button Text</span>
              <input type="text" value={buttonText} onChange={(e) => setButtonText(e.target.value)} placeholder="Submit" />
            </label>
            <label className="crm-add-lead-field">
              <span>Button Background Color</span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="color" value={buttonBgColor} onChange={(e) => setButtonBgColor(e.target.value)} style={{ width: '44px', height: '38px', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer' }} />
                <input type="text" value={buttonBgColor} onChange={(e) => setButtonBgColor(e.target.value)} style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px', fontSize: '0.85rem' }} />
              </div>
            </label>
            <label className="crm-add-lead-field">
              <span>Button Text Color</span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="color" value={buttonTextColor} onChange={(e) => setButtonTextColor(e.target.value)} style={{ width: '44px', height: '38px', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer' }} />
                <input type="text" value={buttonTextColor} onChange={(e) => setButtonTextColor(e.target.value)} style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px', fontSize: '0.85rem' }} />
              </div>
            </label>
            <label className="crm-add-lead-field">
              <span>Overlay Color</span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="color" value={overlayColor} onChange={(e) => setOverlayColor(e.target.value)} style={{ width: '44px', height: '38px', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer' }} />
                <input type="text" value={overlayColor} onChange={(e) => setOverlayColor(e.target.value)} style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px', fontSize: '0.85rem' }} />
              </div>
            </label>
            <label className="crm-add-lead-field">
              <span>Overlay Opacity (%)</span>
              <input type="number" min={0} max={100} value={overlayOpacity} onChange={(e) => setOverlayOpacity(parseInt(e.target.value) || 0)} />
            </label>
            <label className="crm-add-lead-field">
              <span>Popup Position</span>
              <select value={popupPosition} onChange={(e) => setPopupPosition(e.target.value as PopupFormRow['popup_position'])}>
                {POSITION_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </label>
          </div>
          <label className="crm-add-lead-field" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <span>Activate this form on the landing page (only one form can be active at a time)</span>
          </label>
        </div>

        {/* Success & Auto-close */}
        <div style={{ background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '16px', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>After Submission</h3>
          <div className="crm-add-lead-grid">
            <label className="crm-add-lead-field" style={{ gridColumn: '1 / -1' }}>
              <span>Custom Success Message (optional)</span>
              <input type="text" value={successMessage} onChange={(e) => setSuccessMessage(e.target.value)} placeholder="Thank you! We'll be in touch soon." />
            </label>
            <label className="crm-add-lead-field" style={{ maxWidth: '200px' }}>
              <span>Auto-close Delay (seconds, 0 = no auto-close)</span>
              <input type="number" min={0} max={30} value={autoCloseDelay} onChange={(e) => setAutoCloseDelay(parseInt(e.target.value) || 0)} />
            </label>
          </div>
        </div>

        {/* Live Preview */}
        {showPreview && fields.length > 0 && (
          <div style={{ position: 'fixed', inset: 0, background: overlayRgba(), zIndex: 9999, display: 'flex', alignItems: popupPosition === 'center' ? 'center' : 'flex-end', justifyContent: popupPosition === 'bottom_left' ? 'flex-start' : popupPosition === 'bottom_right' ? 'flex-end' : 'center', padding: '20px' }} onClick={() => setShowPreview(false)}>
            <div style={{ background: '#fff', borderRadius: '16px', maxWidth: '440px', width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: '28px', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
              <button type="button" onClick={() => setShowPreview(false)} style={{ position: 'absolute', top: '12px', right: '12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.5rem', color: '#94a3b8' }}>×</button>
              {imageUrl && (
                <div style={{ marginBottom: '16px', textAlign: 'center' }}>
                  <img src={imageUrl} alt="" style={{ maxHeight: '80px', maxWidth: '100%', borderRadius: '8px' }} />
                </div>
              )}
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '6px', color: '#0f172a' }}>{title}</h2>
              <p style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: '8px' }}>{subtitle}</p>
              {description && (
                <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '20px', lineHeight: 1.5 }}>{description}</p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {fields.map((field) => (
                  <div key={field.id}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px', display: 'block' }}>
                      {field.label || 'Untitled'} {field.required && <span style={{ color: '#ef4444' }}>*</span>}
                    </label>
                    {field.type === 'textarea' ? (
                      <textarea placeholder={field.placeholder} rows={3} style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', fontSize: '0.88rem' }} readOnly defaultValue={field.default_value} />
                    ) : field.type === 'select' ? (
                      <select style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', fontSize: '0.88rem' }} disabled defaultValue={field.default_value}>
                        <option value="">Select...</option>
                        {field.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : field.type === 'radio' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {field.options.map((opt) => (
                          <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#475569', cursor: 'pointer' }}>
                            <input type="radio" name={field.id} readOnly style={{ accentColor: buttonBgColor }} />
                            {opt}
                          </label>
                        ))}
                      </div>
                    ) : field.type === 'checkbox' ? (
                      <input type="checkbox" readOnly />
                    ) : (
                      <input type={field.type === 'number' ? 'number' : field.type} placeholder={field.placeholder} style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', fontSize: '0.88rem' }} readOnly defaultValue={field.default_value} />
                    )}
                  </div>
                ))}
              </div>
              <button type="button" style={{ width: '100%', marginTop: '20px', padding: '14px', borderRadius: '10px', border: 'none', background: buttonBgColor, color: buttonTextColor, fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}>
                {buttonText}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '12px 16px', color: '#dc2626', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} /> {error}
          </div>
        )}
        {saved && (
          <div style={{ background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.3)', borderRadius: '8px', padding: '12px 16px', color: '#16a34a', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} /> Form saved successfully.
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
          <button type="button" className="crm-add-lead-submit" onClick={handleSaveForm} disabled={saving || !name.trim()} style={{ flex: 1 }}>
            {saving ? <Loader2 size={18} className="crm-spin" /> : <Save size={18} />}
            {saving ? 'Saving...' : editingForm ? 'Update Form' : 'Create Form'}
          </button>
          {editingForm && (
            <button type="button" className="crm-add-lead-cancel" onClick={onCancelEdit}>
              Cancel
            </button>
          )}
        </div>
      </>
    );
  }

  // Forms list view
  return (
    <>
      <div className="crm-settings-card-header">
        <h2 className="crm-settings-card-title"><MousePointerClick size={20} style={{ color: '#7c3aed' }} /> Popup Form Builder</h2>
        <p className="crm-settings-card-desc">Create custom popup forms for your landing page. Submissions go straight to your leads.</p>
      </div>

      {saved && (
        <div style={{ background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.3)', borderRadius: '8px', padding: '12px 16px', color: '#16a34a', fontSize: '0.85rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={16} /> Form saved successfully.
        </div>
      )}

      <button type="button" onClick={() => onEdit({} as PopupFormRow)} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 18px', border: '2px dashed #7c3aed', borderRadius: '10px', background: 'rgba(124,58,237,0.04)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#7c3aed', marginBottom: '20px', transition: 'all 0.15s' }}>
        <Plus size={18} /> Create New Form
      </button>

      {forms.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8', border: '2px dashed #e2e8f0', borderRadius: '12px' }}>
          <MousePointerClick size={40} style={{ margin: '0 auto 12px', color: '#cbd5e1' }} />
          <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>No popup forms yet</p>
          <p style={{ fontSize: '0.82rem', marginTop: '4px' }}>Click "Create New Form" to build your first one.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {forms.map((form) => (
            <div key={form.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', border: '1px solid #e2e8f0', borderRadius: '10px', background: form.is_active ? 'rgba(22,163,74,0.04)' : '#fff' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>{form.name}</strong>
                  {form.is_active && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '20px', background: 'rgba(22,163,74,0.1)', color: '#16a34a', fontSize: '0.72rem', fontWeight: 700 }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a' }} /> LIVE
                    </span>
                  )}
                  {form.show_once && (
                    <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(99,102,241,0.1)', color: '#6366f1', fontWeight: 600 }}>once per visitor</span>
                  )}
                </div>
                <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '4px' }}>
                  {form.fields.length} field{form.fields.length !== 1 ? 's' : ''} · Trigger: {TRIGGER_OPTIONS.find((t) => t.value === form.trigger_type)?.label || form.trigger_type} · {form.button_text}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button type="button" onClick={() => onToggleActive(form)} style={{ padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', background: form.is_active ? '#fff' : 'rgba(22,163,74,0.06)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: form.is_active ? '#64748b' : '#16a34a' }}>
                  {form.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button type="button" onClick={() => onEdit(form)} style={{ padding: '6px', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#fff', cursor: 'pointer', color: '#475569' }}><Pencil size={15} /></button>
                <button type="button" onClick={() => onDelete(form.id)} style={{ padding: '6px', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#fff', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
