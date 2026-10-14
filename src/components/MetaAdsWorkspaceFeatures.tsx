import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  FileBarChart,
  Image,
  Loader2,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface SessionUser {
  id: string;
  email?: string;
}

interface Campaign {
  id: string;
  name: string;
}

interface WorkspaceProps {
  session: { user: SessionUser };
  campaigns: Campaign[];
}

type WorkspaceTab = 'audiences' | 'creatives' | 'leads' | 'reports' | 'alerts' | 'activity';

type Audience = {
  id: string;
  name: string;
  audience_type: string;
  description: string | null;
  locations: string[];
  age_min: number;
  age_max: number;
  gender: string;
  interests: string[];
  placements: string;
};

type Creative = {
  id: string;
  name: string;
  format: string;
  image_url: string | null;
  headline: string | null;
  primary_text: string | null;
  call_to_action: string;
  destination_url: string | null;
  tags: string[];
};

type Lead = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  captured_at: string;
  campaign_id: string | null;
};

type Report = {
  id: string;
  name: string;
  frequency: string;
  recipient_emails: string[];
  date_range: string;
  is_enabled: boolean;
};

type AlertRule = {
  id: string;
  name: string;
  metric: string;
  operator: string;
  threshold: number;
  campaign_id: string | null;
  is_enabled: boolean;
  last_triggered_at: string | null;
};

type Activity = {
  id: string;
  action: string;
  description: string;
  created_at: string;
};

const tabs: Array<{ id: WorkspaceTab; label: string; icon: typeof Users }> = [
  { id: 'audiences', label: 'Audiences', icon: Users },
  { id: 'creatives', label: 'Creative library', icon: Image },
  { id: 'leads', label: 'Lead inbox', icon: Sparkles },
  { id: 'reports', label: 'Reports', icon: FileBarChart },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'activity', label: 'Activity', icon: CheckCircle2 },
];

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--border-subtle)',
  borderRadius: '8px',
  background: 'var(--bg-card)',
  color: 'var(--text-main)',
  fontSize: '0.82rem',
  outline: 'none',
};

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-subtle)',
  borderRadius: '12px',
};

export default function MetaAdsWorkspaceFeatures({ session, campaigns }: WorkspaceProps) {
  const [tab, setTab] = useState<WorkspaceTab>('audiences');
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [alerts, setAlerts] = useState<AlertRule[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  const [audienceName, setAudienceName] = useState('');
  const [audienceType, setAudienceType] = useState('saved');
  const [locations, setLocations] = useState('');
  const [interests, setInterests] = useState('');
  const [ageMin, setAgeMin] = useState('18');
  const [ageMax, setAgeMax] = useState('65');

  const [creativeName, setCreativeName] = useState('');
  const [creativeFormat, setCreativeFormat] = useState('image');
  const [creativeImage, setCreativeImage] = useState('');
  const [creativeHeadline, setCreativeHeadline] = useState('');
  const [creativeText, setCreativeText] = useState('');
  const [creativeUrl, setCreativeUrl] = useState('');

  const [reportName, setReportName] = useState('');
  const [reportEmails, setReportEmails] = useState(session.user.email || '');
  const [reportFrequency, setReportFrequency] = useState('weekly');

  const [alertName, setAlertName] = useState('');
  const [alertMetric, setAlertMetric] = useState('cpl');
  const [alertOperator, setAlertOperator] = useState('greater_than');
  const [alertThreshold, setAlertThreshold] = useState('');
  const [alertCampaign, setAlertCampaign] = useState('');

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [audienceResult, creativeResult, leadResult, reportResult, alertResult, activityResult] = await Promise.all([
        supabase.from('meta_ad_audiences').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }),
        supabase.from('meta_ad_creatives').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }),
        supabase.from('meta_ad_leads').select('*').eq('user_id', session.user.id).order('captured_at', { ascending: false }),
        supabase.from('meta_ad_reports').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }),
        supabase.from('meta_ad_alerts').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }),
        supabase.from('meta_ad_activity').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(40),
      ]);
      const failed = [audienceResult, creativeResult, leadResult, reportResult, alertResult, activityResult].find(result => result.error);
      if (failed?.error) throw failed.error;
      setAudiences((audienceResult.data || []) as Audience[]);
      setCreatives((creativeResult.data || []) as Creative[]);
      setLeads((leadResult.data || []) as Lead[]);
      setReports((reportResult.data || []) as Report[]);
      setAlerts((alertResult.data || []) as AlertRule[]);
      setActivity((activityResult.data || []) as Activity[]);
    } catch {
      setError('Could not load the Ads Manager workspace. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [session.user.id]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const logActivity = async (action: string, description: string) => {
    await supabase.from('meta_ad_activity').insert({ action, description });
  };

  const resetForm = () => {
    setShowForm(false);
    setAudienceName('');
    setLocations('');
    setInterests('');
    setCreativeName('');
    setCreativeImage('');
    setCreativeHeadline('');
    setCreativeText('');
    setCreativeUrl('');
    setReportName('');
    setAlertName('');
    setAlertThreshold('');
    setAlertCampaign('');
  };

  const saveAudience = async () => {
    if (!audienceName.trim()) return setError('Give the audience a name first.');
    setSaving(true);
    setError('');
    try {
      const { error: insertError } = await supabase.from('meta_ad_audiences').insert({
        name: audienceName.trim(),
        audience_type: audienceType,
        locations: locations.split(',').map(value => value.trim()).filter(Boolean),
        interests: interests.split(',').map(value => value.trim()).filter(Boolean),
        age_min: Number(ageMin),
        age_max: Number(ageMax),
      });
      if (insertError) throw insertError;
      await logActivity('audience_created', `Created audience “${audienceName.trim()}”.`);
      resetForm();
      await loadWorkspace();
    } catch {
      setError('Could not save the audience. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const saveCreative = async () => {
    if (!creativeName.trim()) return setError('Give the creative a name first.');
    setSaving(true);
    setError('');
    try {
      const { error: insertError } = await supabase.from('meta_ad_creatives').insert({
        name: creativeName.trim(),
        format: creativeFormat,
        image_url: creativeImage.trim() || null,
        headline: creativeHeadline.trim() || null,
        primary_text: creativeText.trim() || null,
        destination_url: creativeUrl.trim() || null,
      });
      if (insertError) throw insertError;
      await logActivity('creative_saved', `Saved creative “${creativeName.trim()}” to the library.`);
      resetForm();
      await loadWorkspace();
    } catch {
      setError('Could not save the creative. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const saveReport = async () => {
    if (!reportName.trim()) return setError('Give the report a name first.');
    setSaving(true);
    setError('');
    try {
      const { error: insertError } = await supabase.from('meta_ad_reports').insert({
        name: reportName.trim(),
        frequency: reportFrequency,
        recipient_emails: reportEmails.split(',').map(value => value.trim()).filter(Boolean),
      });
      if (insertError) throw insertError;
      await logActivity('report_created', `Created ${reportFrequency} report “${reportName.trim()}”.`);
      resetForm();
      await loadWorkspace();
    } catch {
      setError('Could not save the report. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const saveAlert = async () => {
    if (!alertName.trim() || !alertThreshold) return setError('Add an alert name and threshold first.');
    setSaving(true);
    setError('');
    try {
      const { error: insertError } = await supabase.from('meta_ad_alerts').insert({
        name: alertName.trim(),
        metric: alertMetric,
        operator: alertOperator,
        threshold: Number(alertThreshold),
        campaign_id: alertCampaign || null,
      });
      if (insertError) throw insertError;
      await logActivity('alert_created', `Created alert “${alertName.trim()}”.`);
      resetForm();
      await loadWorkspace();
    } catch {
      setError('Could not save the alert. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const removeRecord = async (table: string, id: string) => {
    if (!window.confirm('Remove this item from your workspace?')) return;
    setError('');
    const { error: deleteError } = await supabase.from(table).delete().eq('id', id);
    if (deleteError) {
      setError('Could not remove this item. Please try again.');
      return;
    }
    await loadWorkspace();
  };

  const filteredAudiences = audiences.filter(item => item.name.toLowerCase().includes(search.toLowerCase()));
  const filteredCreatives = creatives.filter(item => item.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Loader2 size={28} className="crm-spin" style={{ color: '#1877F2' }} /></div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ ...cardStyle, padding: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => { setTab(id); setShowForm(false); setSearch(''); }} style={{ ...tabButtonStyle, background: tab === id ? '#1877F2' : 'transparent', color: tab === id ? '#fff' : 'var(--text-muted)' }}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {error && <div style={errorStyle}><AlertTriangle size={16} /> {error}<button onClick={() => setError('')} style={closeButtonStyle}><X size={14} /></button></div>}

      {tab === 'audiences' && (
        <WorkspaceSection title="Audience planner" description="Save targeting blueprints and reuse them when building campaigns." actionLabel="New audience" onAction={() => setShowForm(value => !value)} icon={<Users size={20} />}>
          {showForm && <AudienceForm {...{ audienceName, setAudienceName, audienceType, setAudienceType, locations, setLocations, interests, setInterests, ageMin, setAgeMin, ageMax, setAgeMax, saving, onSave: saveAudience, onCancel: resetForm }} />}
          <SearchBar value={search} onChange={setSearch} placeholder="Search saved audiences" />
          <div style={gridStyle}>
            {filteredAudiences.map(item => <div key={item.id} style={itemCardStyle}><div style={itemHeaderStyle}><div><strong>{item.name}</strong><small>{item.audience_type} audience</small></div><button onClick={() => removeRecord('meta_ad_audiences', item.id)} style={deleteButtonStyle}><Trash2 size={15} /></button></div><div style={tagRowStyle}>{item.locations.map(location => <span key={location} style={tagStyle}><MapPin size={11} />{location}</span>)}<span style={tagStyle}>{item.age_min}-{item.age_max} years</span></div><p style={mutedTextStyle}>{item.interests.length ? item.interests.join(', ') : 'Broad targeting'}</p></div>)}
          </div>
          {filteredAudiences.length === 0 && <EmptyState icon={<Users size={28} />} title="No audiences saved" text="Create a targeting blueprint to reuse across campaigns." />}
        </WorkspaceSection>
      )}

      {tab === 'creatives' && (
        <WorkspaceSection title="Creative library" description="Keep high-performing copy and creative references ready for your next campaign." actionLabel="Save creative" onAction={() => setShowForm(value => !value)} icon={<Image size={20} />}>
          {showForm && <CreativeForm {...{ creativeName, setCreativeName, creativeFormat, setCreativeFormat, creativeImage, setCreativeImage, creativeHeadline, setCreativeHeadline, creativeText, setCreativeText, creativeUrl, setCreativeUrl, saving, onSave: saveCreative, onCancel: resetForm }} />}
          <SearchBar value={search} onChange={setSearch} placeholder="Search creative library" />
          <div style={gridStyle}>{filteredCreatives.map(item => <div key={item.id} style={itemCardStyle}>{item.image_url && <img src={item.image_url} alt="" style={{ width: '100%', height: '130px', objectFit: 'cover', borderRadius: '8px', marginBottom: '12px' }} />}<div style={itemHeaderStyle}><div><strong>{item.name}</strong><small>{item.format} creative</small></div><button onClick={() => removeRecord('meta_ad_creatives', item.id)} style={deleteButtonStyle}><Trash2 size={15} /></button></div><p style={copyPreviewStyle}>{item.headline || 'No headline added'}</p><p style={mutedTextStyle}>{item.primary_text || 'No primary text added'}</p></div>)}</div>
          {filteredCreatives.length === 0 && <EmptyState icon={<Image size={28} />} title="Your creative library is empty" text="Save reusable headlines, copy, images, and destination links here." />}
        </WorkspaceSection>
      )}

      {tab === 'leads' && <WorkspaceSection title="Lead inbox" description="Review leads captured from Meta forms and keep their status visible to your team." icon={<Sparkles size={20} />}><div style={summaryStripStyle}><Metric label="Total leads" value={String(leads.length)} /><Metric label="New" value={String(leads.filter(lead => lead.status === 'new').length)} /><Metric label="Contacted" value={String(leads.filter(lead => lead.status === 'contacted').length)} /></div>{leads.length ? <div style={{ overflowX: 'auto' }}><table style={tableStyle}><thead><tr><th style={thStyle}>Lead</th><th style={thStyle}>Contact</th><th style={thStyle}>Status</th><th style={thStyle}>Captured</th></tr></thead><tbody>{leads.map(lead => <tr key={lead.id}><td style={tdStyle}><strong>{lead.full_name || 'Unnamed lead'}</strong></td><td style={tdStyle}>{lead.email || lead.phone || 'No contact details'}</td><td style={tdStyle}><span style={statusStyle}>{lead.status}</span></td><td style={tdStyle}>{new Date(lead.captured_at).toLocaleDateString()}</td></tr>)}</tbody></table></div> : <EmptyState icon={<Sparkles size={28} />} title="No Meta leads yet" text="Once lead form syncing is connected, new submissions will appear here for follow-up." />}</WorkspaceSection>}

      {tab === 'reports' && <WorkspaceSection title="Scheduled reports" description="Prepare recurring performance summaries for customers, managers, or your own inbox." actionLabel="New report" onAction={() => setShowForm(value => !value)} icon={<FileBarChart size={20} />}>{showForm && <ReportForm {...{ reportName, setReportName, reportEmails, setReportEmails, reportFrequency, setReportFrequency, saving, onSave: saveReport, onCancel: resetForm }} />}{reports.map(item => <div key={item.id} style={listItemStyle}><div><strong>{item.name}</strong><small>{item.frequency} · {item.recipient_emails.join(', ') || 'No recipients'}</small></div><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ ...statusStyle, background: item.is_enabled ? 'rgba(22,163,74,0.1)' : 'var(--bg-light)', color: item.is_enabled ? '#16a34a' : 'var(--text-dark)' }}>{item.is_enabled ? 'Enabled' : 'Paused'}</span><button onClick={() => removeRecord('meta_ad_reports', item.id)} style={deleteButtonStyle}><Trash2 size={15} /></button></div></div>)}{reports.length === 0 && <EmptyState icon={<FileBarChart size={28} />} title="No reports scheduled" text="Create a recurring report to keep campaign performance visible." />}</WorkspaceSection>}

      {tab === 'alerts' && <WorkspaceSection title="Performance alerts" description="Get ahead of wasted spend with rules for CPL, spend, clicks, or impressions." actionLabel="New alert" onAction={() => setShowForm(value => !value)} icon={<Bell size={20} />}>{showForm && <AlertForm {...{ alertName, setAlertName, alertMetric, setAlertMetric, alertOperator, setAlertOperator, alertThreshold, setAlertThreshold, alertCampaign, setAlertCampaign, campaigns, saving, onSave: saveAlert, onCancel: resetForm }} />}{alerts.map(item => <div key={item.id} style={listItemStyle}><div><strong>{item.name}</strong><small>{item.metric} {item.operator === 'greater_than' ? '>' : '<'} {item.threshold}{item.campaign_id ? ` · ${campaigns.find(campaign => campaign.id === item.campaign_id)?.name || 'Campaign'}` : ' · All campaigns'}</small></div><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={statusStyle}>{item.is_enabled ? 'Watching' : 'Paused'}</span><button onClick={() => removeRecord('meta_ad_alerts', item.id)} style={deleteButtonStyle}><Trash2 size={15} /></button></div></div>)}{alerts.length === 0 && <EmptyState icon={<Bell size={28} />} title="No alerts configured" text="Create an alert to catch expensive or underperforming campaigns earlier." />}</WorkspaceSection>}

      {tab === 'activity' && <WorkspaceSection title="Activity history" description="A simple record of important actions taken in the Ads Manager workspace." icon={<CheckCircle2 size={20} />}>{activity.length ? activity.map(item => <div key={item.id} style={listItemStyle}><div><strong>{item.description}</strong><small>{item.action.replace(/_/g, ' ')}</small></div><time style={{ fontSize: '0.76rem', color: 'var(--text-dark)' }}>{new Date(item.created_at).toLocaleString()}</time></div>) : <EmptyState icon={<CheckCircle2 size={28} />} title="No activity recorded" text="Workspace actions will appear here as you create audiences, creatives, reports, and alerts." />}</WorkspaceSection>}
    </div>
  );
}

function WorkspaceSection({ title, description, actionLabel, onAction, icon, children }: { title: string; description: string; actionLabel?: string; onAction?: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return <section style={{ ...cardStyle, overflow: 'hidden' }}><div style={sectionHeaderStyle}><div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><div style={iconBoxStyle}>{icon}</div><div><h3 style={headingStyle}>{title}</h3><p style={mutedTextStyle}>{description}</p></div></div>{actionLabel && onAction && <button onClick={onAction} style={primaryButtonStyle}><Plus size={15} /> {actionLabel}</button>}</div><div style={{ padding: '20px' }}>{children}</div></section>;
}

function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) { return <div style={{ position: 'relative', marginBottom: '14px' }}><Search size={16} style={{ position: 'absolute', left: '11px', top: '11px', color: 'var(--text-dark)' }} /><input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} style={{ ...inputStyle, paddingLeft: '34px' }} /></div>; }

function AudienceForm(props: { audienceName: string; setAudienceName: (value: string) => void; audienceType: string; setAudienceType: (value: string) => void; locations: string; setLocations: (value: string) => void; interests: string; setInterests: (value: string) => void; ageMin: string; setAgeMin: (value: string) => void; ageMax: string; setAgeMax: (value: string) => void; saving: boolean; onSave: () => void; onCancel: () => void }) { return <FormShell title="Create audience" onSave={props.onSave} onCancel={props.onCancel} saving={props.saving}><Field label="Name"><input value={props.audienceName} onChange={event => props.setAudienceName(event.target.value)} placeholder="South India — Lead buyers" style={inputStyle} /></Field><Field label="Type"><select value={props.audienceType} onChange={event => props.setAudienceType(event.target.value)} style={inputStyle}><option value="saved">Saved audience</option><option value="custom">Custom audience</option><option value="lookalike">Lookalike audience</option></select></Field><Field label="Locations"><input value={props.locations} onChange={event => props.setLocations(event.target.value)} placeholder="India, UAE, Singapore" style={inputStyle} /></Field><Field label="Interests"><input value={props.interests} onChange={event => props.setInterests(event.target.value)} placeholder="Investing, trading, finance" style={inputStyle} /></Field><Field label="Age range"><div style={{ display: 'flex', gap: '8px' }}><input type="number" value={props.ageMin} onChange={event => props.setAgeMin(event.target.value)} style={inputStyle} /><input type="number" value={props.ageMax} onChange={event => props.setAgeMax(event.target.value)} style={inputStyle} /></div></Field></FormShell>; }

function CreativeForm(props: { creativeName: string; setCreativeName: (value: string) => void; creativeFormat: string; setCreativeFormat: (value: string) => void; creativeImage: string; setCreativeImage: (value: string) => void; creativeHeadline: string; setCreativeHeadline: (value: string) => void; creativeText: string; setCreativeText: (value: string) => void; creativeUrl: string; setCreativeUrl: (value: string) => void; saving: boolean; onSave: () => void; onCancel: () => void }) { return <FormShell title="Save creative" onSave={props.onSave} onCancel={props.onCancel} saving={props.saving}><Field label="Name"><input value={props.creativeName} onChange={event => props.setCreativeName(event.target.value)} placeholder="Trading webinar — version A" style={inputStyle} /></Field><Field label="Format"><select value={props.creativeFormat} onChange={event => props.setCreativeFormat(event.target.value)} style={inputStyle}><option value="image">Single image</option><option value="video">Video</option><option value="carousel">Carousel</option></select></Field><Field label="Image URL"><input value={props.creativeImage} onChange={event => props.setCreativeImage(event.target.value)} placeholder="https://..." style={inputStyle} /></Field><Field label="Headline"><input value={props.creativeHeadline} onChange={event => props.setCreativeHeadline(event.target.value)} placeholder="Start your trading journey" style={inputStyle} /></Field><Field label="Primary text"><textarea value={props.creativeText} onChange={event => props.setCreativeText(event.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} /></Field><Field label="Destination URL"><input value={props.creativeUrl} onChange={event => props.setCreativeUrl(event.target.value)} placeholder="https://..." style={inputStyle} /></Field></FormShell>; }

function ReportForm(props: { reportName: string; setReportName: (value: string) => void; reportEmails: string; setReportEmails: (value: string) => void; reportFrequency: string; setReportFrequency: (value: string) => void; saving: boolean; onSave: () => void; onCancel: () => void }) { return <FormShell title="Schedule report" onSave={props.onSave} onCancel={props.onCancel} saving={props.saving}><Field label="Report name"><input value={props.reportName} onChange={event => props.setReportName(event.target.value)} placeholder="Weekly performance summary" style={inputStyle} /></Field><Field label="Frequency"><select value={props.reportFrequency} onChange={event => props.setReportFrequency(event.target.value)} style={inputStyle}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></Field><Field label="Recipients"><input value={props.reportEmails} onChange={event => props.setReportEmails(event.target.value)} placeholder="name@company.com, manager@company.com" style={inputStyle} /></Field></FormShell>; }

function AlertForm(props: { alertName: string; setAlertName: (value: string) => void; alertMetric: string; setAlertMetric: (value: string) => void; alertOperator: string; setAlertOperator: (value: string) => void; alertThreshold: string; setAlertThreshold: (value: string) => void; alertCampaign: string; setAlertCampaign: (value: string) => void; campaigns: Campaign[]; saving: boolean; onSave: () => void; onCancel: () => void }) { return <FormShell title="Create alert" onSave={props.onSave} onCancel={props.onCancel} saving={props.saving}><Field label="Alert name"><input value={props.alertName} onChange={event => props.setAlertName(event.target.value)} placeholder="CPL needs attention" style={inputStyle} /></Field><Field label="Metric"><select value={props.alertMetric} onChange={event => props.setAlertMetric(event.target.value)} style={inputStyle}><option value="cpl">Cost per lead</option><option value="spend">Spend</option><option value="clicks">Clicks</option><option value="impressions">Impressions</option></select></Field><Field label="Condition"><div style={{ display: 'flex', gap: '8px' }}><select value={props.alertOperator} onChange={event => props.setAlertOperator(event.target.value)} style={inputStyle}><option value="greater_than">Greater than</option><option value="less_than">Less than</option></select><input type="number" value={props.alertThreshold} onChange={event => props.setAlertThreshold(event.target.value)} placeholder="100" style={inputStyle} /></div></Field><Field label="Campaign scope"><select value={props.alertCampaign} onChange={event => props.setAlertCampaign(event.target.value)} style={inputStyle}><option value="">All campaigns</option>{props.campaigns.map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select></Field></FormShell>; }

function FormShell({ title, onSave, onCancel, saving, children }: { title: string; onSave: () => void; onCancel: () => void; saving: boolean; children: React.ReactNode }) { return <div style={formStyle}><h4 style={{ margin: '0 0 14px', color: 'var(--text-main)' }}>{title}</h4><div style={formGridStyle}>{children}</div><div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}><button onClick={onSave} disabled={saving} style={primaryButtonStyle}>{saving ? <Loader2 size={15} className="crm-spin" /> : <CheckCircle2 size={15} />} Save</button><button onClick={onCancel} style={secondaryButtonStyle}>Cancel</button></div></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>{label}{children}</label>; }
function EmptyState({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div style={{ textAlign: 'center', padding: '42px 20px', color: 'var(--text-dark)' }}><div style={{ marginBottom: '10px' }}>{icon}</div><strong style={{ display: 'block', color: 'var(--text-main)', marginBottom: '5px' }}>{title}</strong><span style={{ fontSize: '0.8rem' }}>{text}</span></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div><div style={{ fontSize: '0.72rem', color: 'var(--text-dark)', textTransform: 'uppercase' }}>{label}</div><strong style={{ color: 'var(--text-main)', fontSize: '1.1rem' }}>{value}</strong></div>; }

const tabButtonStyle: React.CSSProperties = { border: 'none', borderRadius: '8px', padding: '9px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' };
const sectionHeaderStyle: React.CSSProperties = { padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' };
const iconBoxStyle: React.CSSProperties = { width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(24,119,242,0.1)', color: '#1877F2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
const headingStyle: React.CSSProperties = { margin: 0, fontSize: '0.95rem', color: 'var(--text-main)' };
const mutedTextStyle: React.CSSProperties = { margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 };
const primaryButtonStyle: React.CSSProperties = { border: 'none', borderRadius: '8px', padding: '9px 13px', background: '#1877F2', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' };
const secondaryButtonStyle: React.CSSProperties = { border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '9px 13px', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' };
const errorStyle: React.CSSProperties = { padding: '11px 14px', borderRadius: '9px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#dc2626', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '8px' };
const closeButtonStyle: React.CSSProperties = { marginLeft: 'auto', background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' };
const formStyle: React.CSSProperties = { marginBottom: '16px', padding: '16px', background: 'var(--bg-light)', borderRadius: '10px', border: '1px solid var(--border-subtle)' };
const formGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' };
const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '12px' };
const itemCardStyle: React.CSSProperties = { padding: '14px', border: '1px solid var(--border-subtle)', borderRadius: '10px', background: 'var(--bg-card)' };
const itemHeaderStyle: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' };
const tagRowStyle: React.CSSProperties = { display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '12px' };
const tagStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 7px', borderRadius: '999px', background: 'rgba(24,119,242,0.08)', color: '#1d4ed8', fontSize: '0.68rem', fontWeight: 600 };
const deleteButtonStyle: React.CSSProperties = { border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer', padding: '3px' };
const copyPreviewStyle: React.CSSProperties = { margin: '12px 0 0', color: 'var(--text-main)', fontSize: '0.82rem', fontWeight: 700 };
const listItemStyle: React.CSSProperties = { padding: '14px 0', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' };
const statusStyle: React.CSSProperties = { display: 'inline-block', padding: '4px 8px', borderRadius: '999px', background: 'rgba(22,163,74,0.1)', color: '#16a34a', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase' };
const summaryStripStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', padding: '14px', marginBottom: '16px', borderRadius: '10px', background: 'var(--bg-light)' };
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' };
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', background: 'var(--bg-light)', color: 'var(--text-main)', fontSize: '0.72rem', textTransform: 'uppercase' };
const tdStyle: React.CSSProperties = { padding: '11px 12px', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' };
