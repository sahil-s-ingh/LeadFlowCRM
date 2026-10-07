import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import {
  ArrowLeft, RefreshCw, Loader2, Plus, Trash2, Pencil,
  GripVertical, Type, Hash, Calendar, List, FileText, X, Check,
} from 'lucide-react';

interface CustomField {
  id: string;
  field_name: string;
  field_key: string;
  field_type: 'text' | 'number' | 'select' | 'date' | 'textarea';
  options: string[];
  sort_order: number;
  created_at: string;
}

interface CustomLeadFieldsProps {
  session: Session;
  onBack: () => void;
}

const FIELD_TYPE_ICONS: Record<string, typeof Type> = {
  text: Type,
  number: Hash,
  select: List,
  date: Calendar,
  textarea: FileText,
};

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: 'Text',
  number: 'Number',
  select: 'Dropdown',
  date: 'Date',
  textarea: 'Long Text',
};

function toFieldKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export default function CustomLeadFields({ session, onBack }: CustomLeadFieldsProps) {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fieldName, setFieldName] = useState('');
  const [fieldType, setFieldType] = useState<CustomField['field_type']>('text');
  const [fieldOptions, setFieldOptions] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchFields = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('custom_lead_fields')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) {
      console.error('Failed to load custom fields:', error.message);
    }
    setFields((data || []) as CustomField[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFields();
  }, [fetchFields]);

  const resetForm = () => {
    setFieldName('');
    setFieldType('text');
    setFieldOptions('');
    setEditingId(null);
    setError('');
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!fieldName.trim()) {
      setError('Field name is required');
      return;
    }
    const key = toFieldKey(fieldName);
    if (!key) {
      setError('Field name must contain at least one letter or number');
      return;
    }
    if (fieldType === 'select' && !fieldOptions.trim()) {
      setError('Dropdown options are required. Separate with commas.');
      return;
    }

    setSaving(true);
    setError('');

    const options = fieldType === 'select'
      ? fieldOptions.split(',').map((o) => o.trim()).filter(Boolean)
      : [];

    try {
      if (editingId) {
        const { error: updateError } = await supabase
          .from('custom_lead_fields')
          .update({
            field_name: fieldName.trim(),
            field_type: fieldType,
            options: options,
          })
          .eq('id', editingId);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('custom_lead_fields')
          .insert({
            field_name: fieldName.trim(),
            field_key: key,
            field_type: fieldType,
            options: options,
            sort_order: fields.length,
          });
        if (insertError) {
          if (insertError.code === '23505') {
            throw new Error('A field with this name already exists');
          }
          throw insertError;
        }
      }
      resetForm();
      fetchFields();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save field');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this custom field? Values stored on leads will also be removed.')) return;
    const { error } = await supabase.from('custom_lead_fields').delete().eq('id', id);
    if (error) {
      console.error('Failed to delete field:', error.message);
    }
    fetchFields();
  };

  const handleEdit = (field: CustomField) => {
    setEditingId(field.id);
    setFieldName(field.field_name);
    setFieldType(field.field_type);
    setFieldOptions(field.options.join(', '));
    setShowForm(true);
    setError('');
  };

  return (
    <div className="ea-container">
      <div className="ea-header">
        <div className="ea-header-left">
          <button className="ea-back-btn" onClick={onBack}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="ea-title">Custom Lead Fields</h1>
            <p className="ea-subtitle">Add custom fields to capture information specific to your business on every lead</p>
          </div>
        </div>
        <div className="ea-header-actions">
          <button className="ea-refresh-btn" onClick={fetchFields} disabled={loading}>
            {loading ? <Loader2 size={16} className="crm-spin" /> : <RefreshCw size={16} />}
            Refresh
          </button>
          {!showForm && (
            <button className="ea-refresh-btn" style={{ background: '#2563eb', color: '#fff', borderColor: '#2563eb' }} onClick={() => { resetForm(); setShowForm(true); }}>
              <Plus size={16} /> New Field
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(220,38,38,0.08)', borderRadius: '10px', border: '1px solid rgba(220,38,38,0.15)', color: '#dc2626', fontSize: '0.85rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <X size={16} /> {error}
        </div>
      )}

      {showForm && (
        <div className="ea-card ea-card-elevated" style={{ marginBottom: '20px' }}>
          <div className="ea-card-header">
            <div className="ea-card-title">
              <div className="ea-card-icon ea-card-icon-blue">
                {editingId ? <Pencil size={18} /> : <Plus size={18} />}
              </div>
              <h2>{editingId ? 'Edit Field' : 'Create New Field'}</h2>
            </div>
            <button className="ea-back-btn" onClick={resetForm}>
              <X size={16} />
            </button>
          </div>
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>
                Field Name <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                value={fieldName}
                onChange={(e) => setFieldName(e.target.value)}
                placeholder="e.g. Loan Type, Business Name, Annual Revenue"
                className="ea-search-input"
                style={{ width: '100%', paddingLeft: '12px' }}
                disabled={!!editingId}
              />
              <small style={{ color: '#9ca3af', fontSize: '0.75rem' }}>
                {editingId ? 'Field name cannot be changed after creation.' : 'This is the label shown when editing a lead.'}
              </small>
            </div>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>
                Field Type <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {Object.entries(FIELD_TYPE_LABELS).map(([type, label]) => {
                  const Icon = FIELD_TYPE_ICONS[type];
                  return (
                    <button
                      key={type}
                      onClick={() => setFieldType(type as CustomField['field_type'])}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '8px 14px', borderRadius: '8px',
                        border: fieldType === type ? '2px solid #2563eb' : '1px solid rgba(0,0,0,0.1)',
                        background: fieldType === type ? 'rgba(37,99,235,0.05)' : 'transparent',
                        cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
                        color: fieldType === type ? '#2563eb' : '#6b7280',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <Icon size={15} /> {label}
                    </button>
                  );
                })}
              </div>
            </div>
            {fieldType === 'select' && (
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>
                  Dropdown Options <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  value={fieldOptions}
                  onChange={(e) => setFieldOptions(e.target.value)}
                  placeholder="Option 1, Option 2, Option 3"
                  className="ea-search-input"
                  style={{ width: '100%', paddingLeft: '12px' }}
                />
                <small style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Separate options with commas</small>
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '10px 20px', borderRadius: '8px',
                  background: '#2563eb', color: '#fff',
                  border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                  fontWeight: 700, fontSize: '0.85rem',
                }}
              >
                {saving ? <Loader2 size={16} className="crm-spin" /> : <Check size={16} />}
                {saving ? 'Saving...' : editingId ? 'Update Field' : 'Create Field'}
              </button>
              <button
                onClick={resetForm}
                style={{
                  padding: '10px 20px', borderRadius: '8px',
                  background: 'transparent', color: '#6b7280',
                  border: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer',
                  fontWeight: 600, fontSize: '0.85rem',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="ea-card ea-card-elevated">
        <div className="ea-card-header">
          <div className="ea-card-title">
            <div className="ea-card-icon ea-card-icon-violet"><List size={18} /></div>
            <h2>Your Custom Fields ({fields.length})</h2>
          </div>
        </div>

        {loading ? (
          <div className="ea-chart-empty" style={{ padding: '60px' }}>
            <Loader2 size={28} className="crm-spin" style={{ color: '#2563eb', marginBottom: 10 }} />
            <p>Loading fields...</p>
          </div>
        ) : fields.length === 0 ? (
          <div className="ea-chart-empty" style={{ padding: '60px' }}>
            <List size={40} style={{ opacity: 0.25, marginBottom: 10 }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>No custom fields yet</h3>
            <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Click "New Field" to add fields like Loan Type, Business Name, or Annual Revenue.</p>
          </div>
        ) : (
          <div style={{ padding: '8px' }}>
            {fields.map((field) => {
              const Icon = FIELD_TYPE_ICONS[field.field_type] || Type;
              return (
                <div key={field.id} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '14px 16px', borderRadius: '10px',
                  borderBottom: '1px solid rgba(0,0,0,0.04)',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.02)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <GripVertical size={16} style={{ color: '#d1d5db', flexShrink: 0 }} />
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(37,99,235,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={16} style={{ color: '#2563eb' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1f2937' }}>{field.field_name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                      {FIELD_TYPE_LABELS[field.field_type]}
                      {field.field_type === 'select' && field.options.length > 0 && ` · ${field.options.length} options`}
                      {' · '}{field.field_key}
                    </div>
                  </div>
                  <button
                    onClick={() => handleEdit(field)}
                    style={{
                      padding: '6px 10px', borderRadius: '6px',
                      border: '1px solid rgba(0,0,0,0.1)', background: 'transparent',
                      cursor: 'pointer', color: '#6b7280',
                    }}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(field.id)}
                    style={{
                      padding: '6px 10px', borderRadius: '6px',
                      border: '1px solid rgba(220,38,38,0.15)', background: 'rgba(220,38,38,0.04)',
                      cursor: 'pointer', color: '#dc2626',
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ marginTop: '16px', padding: '14px 16px', background: 'rgba(37,99,235,0.04)', borderRadius: '10px', border: '1px solid rgba(37,99,235,0.08)', fontSize: '0.82rem', color: '#6b7280', lineHeight: 1.5 }}>
        <strong style={{ color: '#2563eb' }}>How it works:</strong> Custom fields appear in the lead edit modal. When you open a lead, you'll see these fields below the standard information. Values are saved per lead and can be used to organize and filter your pipeline.
      </div>
    </div>
  );
}
