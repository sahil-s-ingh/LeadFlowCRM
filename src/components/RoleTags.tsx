import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, X, Tag } from 'lucide-react';

export type RoleType = {
  id: string;
  name: string;
  color: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
};

export type LeadRole = {
  id: string;
  role_type_id: string;
  submission_id: string;
};

// Display-only: shows colored role dots for a lead
export function RoleDots({ leadId, roles, roleTypes }: { leadId: string; roles: LeadRole[]; roleTypes: RoleType[] }) {
  const leadRoles = roles.filter((r) => r.submission_id === leadId);
  if (leadRoles.length === 0) return null;
  return (
    <div className="role-dots">
      {leadRoles.map((lr) => {
        const rt = roleTypes.find((t) => t.id === lr.role_type_id);
        if (!rt) return null;
        return (
          <span key={lr.id} className="role-dot" style={{ background: rt.color }} title={rt.name} />
        );
      })}
    </div>
  );
}

// Display + labels: shows colored pills with role names
export function RolePills({ leadId, roles, roleTypes }: { leadId: string; roles: LeadRole[]; roleTypes: RoleType[] }) {
  const leadRoles = roles.filter((r) => r.submission_id === leadId);
  if (leadRoles.length === 0) return null;
  return (
    <div className="role-pills">
      {leadRoles.map((lr) => {
        const rt = roleTypes.find((t) => t.id === lr.role_type_id);
        if (!rt) return null;
        return (
          <span key={lr.id} className="role-pill" style={{ background: `${rt.color}18`, color: rt.color, border: `1px solid ${rt.color}30` }}>
            {rt.name}
          </span>
        );
      })}
    </div>
  );
}

// Interactive picker: toggle roles on/off for a lead
export function RoleTagPicker({ leadId, sessionUserId, onRolesChanged }: { leadId: string; sessionUserId: string; onRolesChanged?: () => void }) {
  const [roleTypes, setRoleTypes] = useState<RoleType[]>([]);
  const [assignedRoles, setAssignedRoles] = useState<LeadRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchRoleTypes = useCallback(async () => {
    const { data } = await supabase
      .from('lead_role_types')
      .select('id, name, color, description, sort_order, is_active')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    setRoleTypes((data || []) as RoleType[]);
  }, []);

  const fetchAssignedRoles = useCallback(async () => {
    const { data } = await supabase
      .from('lead_roles')
      .select('id, role_type_id, submission_id')
      .eq('submission_id', leadId);
    setAssignedRoles((data || []) as LeadRole[]);
  }, [leadId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchRoleTypes(), fetchAssignedRoles()]);
      setLoading(false);
    })();
  }, [fetchRoleTypes, fetchAssignedRoles]);

  const toggleRole = async (roleType: RoleType) => {
    const existing = assignedRoles.find((r) => r.role_type_id === roleType.id);
    setToggling(roleType.id);
    try {
      if (existing) {
        await supabase.from('lead_roles').delete().eq('id', existing.id);
        setAssignedRoles((prev) => prev.filter((r) => r.id !== existing.id));
      } else {
        const { data } = await supabase
          .from('lead_roles')
          .insert({ submission_id: leadId, role_type_id: roleType.id, assigned_by: sessionUserId })
          .select('id, role_type_id, submission_id')
          .single();
        if (data) setAssignedRoles((prev) => [...prev, data as LeadRole]);
      }
      onRolesChanged?.();
    } catch { /* ignore */ }
    finally { setToggling(null); }
  };

  if (loading) {
    return <div className="role-picker-loading">Loading roles...</div>;
  }

  return (
    <div className="role-tag-picker">
      <div className="role-tag-picker-label">
        <Tag size={14} /> CONVERSION ROLE TAGS
      </div>
      <div className="role-tag-picker-chips">
        {roleTypes.map((rt) => {
          const isActive = assignedRoles.some((r) => r.role_type_id === rt.id);
          return (
            <button
              key={rt.id}
              className={`role-tag-chip ${isActive ? 'role-tag-chip-active' : ''}`}
              style={isActive ? { background: `${rt.color}18`, color: rt.color, borderColor: `${rt.color}50` } : {}}
              onClick={() => toggleRole(rt)}
              disabled={toggling === rt.id}
              title={rt.description || rt.name}
            >
              <span className="role-tag-chip-dot" style={{ background: rt.color }} />
              {rt.name}
              {isActive && <X size={12} className="role-tag-chip-remove" />}
              {!isActive && <Plus size={12} className="role-tag-chip-add" />}
            </button>
          );
        })}
        {roleTypes.length === 0 && (
          <span className="role-tag-empty">No role types configured. Add some in Super Admin settings.</span>
        )}
      </div>
    </div>
  );
}

// Super admin: manage role types (CRUD)
export function RoleTypeManager({ sessionUserId }: { sessionUserId: string }) {
  const [roleTypes, setRoleTypes] = useState<RoleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#2563eb');
  const [description, setDescription] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchRoleTypes = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('lead_role_types')
      .select('*')
      .order('sort_order', { ascending: true });
    setRoleTypes((data || []) as RoleType[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRoleTypes(); }, [fetchRoleTypes]);

  const resetForm = () => {
    setName(''); setColor('#2563eb'); setDescription(''); setSortOrder(0);
    setEditingId(null); setShowForm(false); setError('');
  };

  const handleSave = async () => {
    if (!name.trim()) { setError('Role name is required'); return; }
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        const { error: updErr } = await supabase
          .from('lead_role_types')
          .update({ name: name.trim(), color, description: description.trim() || null, sort_order: sortOrder, updated_at: new Date().toISOString() })
          .eq('id', editingId);
        if (updErr) { setError(updErr.message); setSaving(false); return; }
      } else {
        const { error: insErr } = await supabase
          .from('lead_role_types')
          .insert({ name: name.trim(), color, description: description.trim() || null, sort_order: sortOrder, is_active: true });
        if (insErr) { setError(insErr.message); setSaving(false); return; }
      }
      resetForm();
      await fetchRoleTypes();
    } catch { setError('Failed to save role type'); }
    finally { setSaving(false); }
  };

  const handleEdit = (rt: RoleType) => {
    setEditingId(rt.id);
    setName(rt.name); setColor(rt.color); setDescription(rt.description || ''); setSortOrder(rt.sort_order);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this role type? All lead assignments for this role will be removed.')) return;
    await supabase.from('lead_role_types').delete().eq('id', id);
    await fetchRoleTypes();
  };

  const handleToggleActive = async (rt: RoleType) => {
    await supabase.from('lead_role_types').update({ is_active: !rt.is_active, updated_at: new Date().toISOString() }).eq('id', rt.id);
    await fetchRoleTypes();
  };

  const PRESET_COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#8b5cf6', '#0d9488', '#db2777', '#475569'];

  return (
    <div className="role-type-manager">
      <div className="role-type-manager-header">
        <div>
          <h3>Conversion Role Types</h3>
          <p>Define role tags that can be assigned to converted leads (e.g. Partner, IB, Sub IB).</p>
        </div>
        {!showForm && (
          <button className="role-type-add-btn" onClick={() => setShowForm(true)}>
            <Plus size={16} /> Add Role Type
          </button>
        )}
      </div>

      {showForm && (
        <div className="role-type-form">
          <div className="role-type-form-row">
            <label className="role-type-field">
              <span>Role Name <em>*</em></span>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Partner" className="role-type-input" />
            </label>
            <label className="role-type-field">
              <span>Sort Order</span>
              <input type="number" value={sortOrder} min="0" onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)} className="role-type-input" />
            </label>
          </div>
          <label className="role-type-field">
            <span>Description (optional)</span>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this role mean?" className="role-type-input" />
          </label>
          <div className="role-type-color-row">
            <span>Color:</span>
            <div className="role-type-color-swatches">
              {PRESET_COLORS.map((c) => (
                <button key={c} className={`role-type-swatch ${color === c ? 'role-type-swatch-active' : ''}`} style={{ background: c }} onClick={() => setColor(c)} />
              ))}
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="role-type-color-picker" />
            </div>
          </div>
          {error && <div className="role-type-error">{error}</div>}
          <div className="role-type-form-actions">
            <button className="role-type-btn-cancel" onClick={resetForm}>Cancel</button>
            <button className="role-type-btn-save" onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="role-type-loading">Loading...</p>
      ) : roleTypes.length === 0 ? (
        <p className="role-type-empty">No role types yet. Create one to start tagging converted leads.</p>
      ) : (
        <div className="role-type-list">
          {roleTypes.map((rt) => (
            <div key={rt.id} className={`role-type-item ${!rt.is_active ? 'role-type-item-inactive' : ''}`}>
              <span className="role-type-item-dot" style={{ background: rt.color }} />
              <div className="role-type-item-info">
                <strong>{rt.name}</strong>
                {rt.description && <span>{rt.description}</span>}
                <span className="role-type-item-meta">Order: {rt.sort_order} - {rt.is_active ? 'Active' : 'Disabled'}</span>
              </div>
              <div className="role-type-item-actions">
                <button onClick={() => handleToggleActive(rt)} className="role-type-btn-toggle" title={rt.is_active ? 'Disable' : 'Enable'}>
                  {rt.is_active ? 'Disable' : 'Enable'}
                </button>
                <button onClick={() => handleEdit(rt)} className="role-type-btn-edit">Edit</button>
                <button onClick={() => handleDelete(rt.id)} className="role-type-btn-delete">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
