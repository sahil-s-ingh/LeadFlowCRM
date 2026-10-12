import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { Shield, Save, Loader2, Check, User, Mail, Phone, Building2, MapPin, Edit3, X } from 'lucide-react';

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  company_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string | null;
};

export default function AdminProfilePage({ session }: { session: Session }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    company_name: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
    avatar_url: '',
    bio: '',
  });

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: fetchError } = await supabase
        .from('super_admins')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();
      if (fetchError) throw fetchError;
      if (!data) throw new Error('Super admin profile not found');
      setProfile(data as Profile);
      setForm({
        full_name: data.full_name || '',
        phone: data.phone || '',
        company_name: data.company_name || '',
        address_line1: data.address_line1 || '',
        address_line2: data.address_line2 || '',
        city: data.city || '',
        state: data.state || '',
        postal_code: data.postal_code || '',
        country: data.country || '',
        avatar_url: data.avatar_url || '',
        bio: data.bio || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    }
    setLoading(false);
  }, [session.user.id]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const { error: updateError } = await supabase
        .from('super_admins')
        .update({
          full_name: form.full_name || null,
          phone: form.phone || null,
          company_name: form.company_name || null,
          address_line1: form.address_line1 || null,
          address_line2: form.address_line2 || null,
          city: form.city || null,
          state: form.state || null,
          postal_code: form.postal_code || null,
          country: form.country || null,
          avatar_url: form.avatar_url || null,
          bio: form.bio || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.user.id);
      if (updateError) throw updateError;
      setSaved(true);
      setEditing(false);
      loadProfile();
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    }
    setSaving(false);
  };

  const formatDate = (d?: string | null) => {
    if (!d) return 'Unknown';
    try { return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); }
    catch { return 'Unknown'; }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={32} className="crm-spin" style={{ color: '#0f766e' }} />
          <p style={{ marginTop: '12px', color: 'var(--text-dark)', fontSize: '0.88rem' }}>Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px' }}>
      {/* Action bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginBottom: '24px' }}>
        {saved && (
          <span style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '6px 12px', borderRadius: '8px',
            background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.2)',
            color: '#16a34a', fontSize: '0.78rem', fontWeight: 600,
          }}>
            <Check size={14} /> Saved
          </span>
        )}
        {error && (
          <div style={{ padding: '8px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '0.83rem', color: '#dc2626' }}>
            {error}
          </div>
        )}
        {!editing ? (
          <button type="button" onClick={() => setEditing(true)} style={{
            padding: '8px 16px', border: '1px solid var(--border-subtle)', borderRadius: '8px',
            background: 'var(--bg-card)', color: 'var(--text-muted)', fontSize: '0.82rem',
            fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <Edit3 size={14} /> Edit Profile
          </button>
        ) : (
          <>
            <button type="button" onClick={() => { setEditing(false); loadProfile(); }} style={{
              padding: '8px 16px', border: '1px solid var(--border-subtle)', borderRadius: '8px',
              background: 'var(--bg-card)', color: 'var(--text-dark)', fontSize: '0.82rem',
              fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              <X size={14} /> Cancel
            </button>
            <button type="button" onClick={handleSave} disabled={saving} style={{
              padding: '8px 16px', border: 'none', borderRadius: '8px',
              background: saving ? '#94a3b8' : '#0f766e', color: '#fff', fontSize: '0.82rem',
              fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              {saving ? <Loader2 size={14} className="crm-spin" /> : <Save size={14} />} Save Changes
            </button>
          </>
        )}
      </div>

      {/* Profile card */}
      <div style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-subtle)', overflow: 'hidden', marginBottom: '20px' }}>
        <div style={{ height: '100px', background: 'linear-gradient(135deg, #0f172a, #0f766e)' }} />
        <div style={{ padding: '0 28px 24px', marginTop: '-48px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '20px', flexWrap: 'wrap' }}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile" style={{ width: '88px', height: '88px', borderRadius: '50%', border: '4px solid #fff', objectFit: 'cover', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
            ) : (
              <div style={{ width: '88px', height: '88px', borderRadius: '50%', border: '4px solid #fff', background: '#0f766e', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', flexShrink: 0 }}>
                <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff' }}>
                  {(profile?.email || '?').charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div style={{ paddingBottom: '8px', flex: 1, minWidth: '200px' }}>
              <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-main)' }}>
                {profile?.full_name || 'Super Admin'}
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-dark)' }}>{profile?.email}</p>
              {profile?.company_name && <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-dark)' }}>{profile.company_name}</p>}
            </div>
          </div>
          {profile?.bio && !editing && (
            <div style={{ marginTop: '20px', padding: '16px', background: 'var(--bg-light)', borderRadius: '12px' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>{profile.bio}</p>
            </div>
          )}
        </div>
      </div>

      {/* Contact Information */}
      <Section title="Contact Information" icon={<User size={18} />}>
        <ProfileField label="Full Name" icon={<User size={14} />} value={profile?.full_name} editing={editing} formValue={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
        <ProfileField label="Email" icon={<Mail size={14} />} value={profile?.email} editing={false} formValue="" onChange={() => {}} />
        <ProfileField label="Phone Number" icon={<Phone size={14} />} value={profile?.phone} editing={editing} formValue={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
        <ProfileField label="Company Name" icon={<Building2 size={14} />} value={profile?.company_name} editing={editing} formValue={form.company_name} onChange={(v) => setForm({ ...form, company_name: v })} />
      </Section>

      {/* Address */}
      <Section title="Address" icon={<MapPin size={18} />}>
        <ProfileField label="Address Line 1" value={profile?.address_line1} editing={editing} formValue={form.address_line1} onChange={(v) => setForm({ ...form, address_line1: v })} />
        <ProfileField label="Address Line 2" value={profile?.address_line2} editing={editing} formValue={form.address_line2} onChange={(v) => setForm({ ...form, address_line2: v })} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <ProfileField label="City" value={profile?.city} editing={editing} formValue={form.city} onChange={(v) => setForm({ ...form, city: v })} />
          <ProfileField label="State / Province" value={profile?.state} editing={editing} formValue={form.state} onChange={(v) => setForm({ ...form, state: v })} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <ProfileField label="Postal Code" value={profile?.postal_code} editing={editing} formValue={form.postal_code} onChange={(v) => setForm({ ...form, postal_code: v })} />
          <ProfileField label="Country" value={profile?.country} editing={editing} formValue={form.country} onChange={(v) => setForm({ ...form, country: v })} />
        </div>
      </Section>

      {/* About */}
      <Section title="About" icon={<Edit3 size={18} />}>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={labelStyle}>Bio</label>
              <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="Tell us about yourself..." rows={4} style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }} onFocus={(e) => { e.target.style.borderColor = '#0f766e'; }} onBlur={(e) => { e.target.style.borderColor = 'var(--border-subtle)'; }} />
            </div>
            <div>
              <label style={labelStyle}>Avatar URL</label>
              <input type="url" value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} placeholder="https://example.com/photo.jpg" style={inputStyle} onFocus={(e) => { e.target.style.borderColor = '#0f766e'; }} onBlur={(e) => { e.target.style.borderColor = 'var(--border-subtle)'; }} />
            </div>
          </div>
        ) : profile?.bio ? (
          <div style={{ padding: '16px', background: 'var(--bg-light)', borderRadius: '12px' }}>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>{profile.bio}</p>
          </div>
        ) : (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-dark)', margin: 0 }}>No bio added yet. Click Edit Profile to add one.</p>
        )}
      </Section>

      {/* Account Details */}
      <Section title="Account Details" icon={<Shield size={18} />}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <InfoItem label="Account ID" value={(profile?.id?.slice(0, 8) || '—') + '...'} />
          <InfoItem label="Member Since" value={formatDate(profile?.created_at)} />
          <InfoItem label="Last Updated" value={formatDate(profile?.updated_at)} />
          <InfoItem label="Role" value="Super Admin" badge />
        </div>
      </Section>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px', border: '2px solid var(--border-subtle)',
  borderRadius: '10px', fontSize: '0.85rem', outline: 'none',
  boxSizing: 'border-box', transition: 'border-color 0.2s',
};

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-subtle)', padding: '24px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(15,118,110,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0f766e' }}>{icon}</div>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>{title}</h3>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>{children}</div>
    </div>
  );
}

function ProfileField({ label, icon, value, editing, formValue, onChange }: {
  label: string; icon?: React.ReactNode; value: string | null | undefined;
  editing: boolean; formValue: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {editing ? (
        <div style={{ position: 'relative' }}>
          {icon && <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dark)' }}>{icon}</span>}
          <input type="text" value={formValue} onChange={(e) => onChange(e.target.value)} placeholder={`Enter ${label.toLowerCase()}`}
            style={icon ? { ...inputStyle, paddingLeft: '36px' } : inputStyle}
            onFocus={(e) => { e.target.style.borderColor = '#0f766e'; }}
            onBlur={(e) => { e.target.style.borderColor = 'var(--border-subtle)'; }}
          />
        </div>
      ) : (
        <div style={{ padding: '12px 14px', background: value ? 'var(--bg-light)' : 'var(--bg-card)', borderRadius: '10px', border: '1px solid var(--border-subtle)', fontSize: '0.85rem', color: value ? 'var(--text-main)' : 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {icon && <span style={{ color: 'var(--text-dark)' }}>{icon}</span>}
          {value || 'Not set'}
        </div>
      )}
    </div>
  );
}

function InfoItem({ label, value, badge }: { label: string; value: string; badge?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-dark)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>{label}</div>
      {badge ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 12px', borderRadius: '9999px', background: 'rgba(15,118,110,0.1)', color: '#0f766e', fontSize: '0.78rem', fontWeight: 700 }}>
          <Shield size={12} /> {value}
        </span>
      ) : (
        <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 600 }}>{value}</div>
      )}
    </div>
  );
}
