import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import {
  BarChart3, Filter, Save, FlaskConical, Clock3, Gauge, MessageCircle,
  DollarSign, GitCompare, CalendarDays, X, Loader2, Trash2, Plus,
  CheckCircle2, AlertTriangle, TrendingUp, Eye, Copy, ChevronRight,
  Zap, Users, Send, CheckCheck, Activity, Award, Calendar,
} from 'lucide-react';

type BroadcastCampaign = {
  id: string;
  campaign_name?: string;
  template_name: string;
  template_language: string;
  template_components: any[];
  status: string;
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  read_count?: number;
  failed_count: number;
  created_at: string;
  scheduled_at?: string | null;
  phone_number_id?: string | null;
  variable_mapping?: Record<string, string>;
};

const SEGMENT_FIELDS = [
  { value: 'status', label: 'Lead Status', type: 'select', options: ['new', 'called_no_response', 'called_responded', 'interested', 'not_interested', 'converted'] },
  { value: 'state', label: 'State', type: 'text' },
  { value: 'lead_source', label: 'Lead Source', type: 'text' },
  { value: 'fund_amount', label: 'Fund Amount', type: 'text' },
  { value: 'trading_product', label: 'Trading Product', type: 'text' },
];

const SEGMENT_OPERATORS = [
  { value: 'eq', label: 'equals' },
  { value: 'neq', label: 'not equals' },
  { value: 'contains', label: 'contains' },
  { value: 'gt', label: 'greater than' },
  { value: 'lt', label: 'less than' },
];

// ===================== 1. Broadcast Analytics Dashboard =====================
export function BroadcastAnalyticsDashboard({ broadcasts, onClose }: { broadcasts: BroadcastCampaign[]; onClose: () => void }) {
  const completed = broadcasts.filter((b) => b.status === 'completed' || b.status === 'sending');
  const totalSent = completed.reduce((s, b) => s + b.sent_count, 0);
  const totalDelivered = completed.reduce((s, b) => s + b.delivered_count, 0);
  const totalRead = completed.reduce((s, b) => s + (b.read_count || 0), 0);
  const totalFailed = completed.reduce((s, b) => s + b.failed_count, 0);
  const deliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0;
  const readRate = totalDelivered > 0 ? Math.round((totalRead / totalDelivered) * 100) : 0;
  const failRate = totalSent > 0 ? Math.round((totalFailed / totalSent) * 100) : 0;

  // Template performance
  const templatePerf: Record<string, { sent: number; delivered: number; read: number; campaigns: number }> = {};
  completed.forEach((b) => {
    const key = b.template_name;
    if (!templatePerf[key]) templatePerf[key] = { sent: 0, delivered: 0, read: 0, campaigns: 0 };
    templatePerf[key].sent += b.sent_count;
    templatePerf[key].delivered += b.delivered_count;
    templatePerf[key].read += b.read_count || 0;
    templatePerf[key].campaigns += 1;
  });
  const topTemplates = Object.entries(templatePerf).sort((a, b) => b[1].read - a[1].read).slice(0, 5);

  // Send time analysis
  const hourlyData: Record<number, number> = {};
  completed.forEach((b) => {
    const hour = new Date(b.created_at).getHours();
    hourlyData[hour] = (hourlyData[hour] || 0) + b.sent_count;
  });
  const peakHour = Object.entries(hourlyData).sort((a, b) => b[1] - a[1])[0];

  // Trend data (last 10 campaigns)
  const recentCampaigns = [...completed].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10).reverse();
  const maxSent = Math.max(...recentCampaigns.map((c) => c.sent_count), 1);

  return (
    <div className="wb-modal-overlay" onClick={onClose}>
      <div className="wb-modal-card wb-modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="wb-modal-header">
          <div className="wb-modal-title"><BarChart3 size={18} /><span>Broadcast Analytics</span></div>
          <button onClick={onClose} className="wb-modal-close"><X size={18} /></button>
        </div>
        <div className="wb-modal-body">
          <div className="wb-analytics-summary">
            <div className="wb-analytics-stat"><Send size={18} /><strong>{totalSent.toLocaleString()}</strong><span>Total Sent</span></div>
            <div className="wb-analytics-stat"><CheckCircle2 size={18} style={{ color: '#16a34a' }} /><strong>{deliveryRate}%</strong><span>Delivery Rate</span></div>
            <div className="wb-analytics-stat"><Eye size={18} style={{ color: '#0891b2' }} /><strong>{readRate}%</strong><span>Read Rate</span></div>
            <div className="wb-analytics-stat"><X size={18} style={{ color: '#dc2626' }} /><strong>{failRate}%</strong><span>Fail Rate</span></div>
          </div>

          <h3 className="wb-analytics-section-title"><TrendingUp size={15} /> Delivery Trend (Recent Campaigns)</h3>
          <div className="wb-analytics-chart">
            {recentCampaigns.length === 0 ? (
              <p className="wb-analytics-empty">No completed campaigns yet.</p>
            ) : recentCampaigns.map((c, i) => (
              <div key={i} className="wb-analytics-bar-row">
                <span className="wb-analytics-bar-label">{c.campaign_name || c.template_name}</span>
                <div className="wb-analytics-bar-track">
                  <div className="wb-analytics-bar-fill" style={{ width: `${(c.sent_count / maxSent) * 100}%` }}>
                    <span className="wb-analytics-bar-value">{c.sent_count}</span>
                  </div>
                </div>
                <span className="wb-analytics-bar-rate">{c.delivered_count > 0 ? Math.round((c.delivered_count / c.sent_count) * 100) : 0}%</span>
              </div>
            ))}
          </div>

          <h3 className="wb-analytics-section-title"><Award size={15} /> Top Performing Templates</h3>
          <div className="wb-analytics-top-list">
            {topTemplates.length === 0 ? (
              <p className="wb-analytics-empty">No template data yet.</p>
            ) : topTemplates.map(([name, perf]) => {
              const trr = perf.delivered > 0 ? Math.round((perf.read / perf.delivered) * 100) : 0;
              const tdr = perf.sent > 0 ? Math.round((perf.delivered / perf.sent) * 100) : 0;
              return (
                <div key={name} className="wb-analytics-top-item">
                  <div className="wb-analytics-top-info">
                    <strong>{name}</strong>
                    <span>{perf.campaigns} campaign{perf.campaigns !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="wb-analytics-top-stats">
                    <span className="wb-analytics-top-stat-blue">{perf.sent.toLocaleString()} sent</span>
                    <span className="wb-analytics-top-stat-green">{tdr}% delivered</span>
                    <span className="wb-analytics-top-stat-cyan">{trr}% read</span>
                  </div>
                </div>
              );
            })}
          </div>

          {peakHour && (
            <div className="wb-analytics-insight">
              <Zap size={14} />
              <span>Your best send time is around <strong>{peakHour[0]}:00</strong> with {peakHour[1]} messages sent during that hour.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===================== 2. Segmentation Builder =====================
export function SegmentationBuilder({ session, onApply, onClose }: { session: Session; onApply: (conditions: SegmentCondition[], count: number) => void; onClose: () => void }) {
  const [conditions, setConditions] = useState<SegmentCondition[]>([{ field: 'status', operator: 'eq', value: 'interested' }]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [savedSegments, setSavedSegments] = useState<{ id: string; name: string; conditions: SegmentCondition[] }[]>([]);
  const [segmentName, setSegmentName] = useState('');
  const [saving, setSaving] = useState(false);

  type SegmentCondition = { field: string; operator: string; value: string };

  const fetchCount = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase.from('submissions').select('id', { count: 'exact', head: true }).is('deleted_at', null);
      for (const cond of conditions) {
        if (!cond.value.trim()) continue;
        if (cond.operator === 'eq') query = query.eq(cond.field, cond.value);
        else if (cond.operator === 'neq') query = query.neq(cond.field, cond.value);
        else if (cond.operator === 'contains') query = query.ilike(cond.field, `%${cond.value}%`);
        else if (cond.operator === 'gt') query = query.gt(cond.field, cond.value);
        else if (cond.operator === 'lt') query = query.lt(cond.field, cond.value);
      }
      const { count: c } = await query;
      setCount(c || 0);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [conditions]);

  useEffect(() => { fetchCount(); }, [fetchCount]);

  const fetchSavedSegments = useCallback(async () => {
    try {
      const { data } = await supabase.from('wa_broadcast_segments').select('*').order('name');
      setSavedSegments((data || []).map((s: any) => ({ id: s.id, name: s.name, conditions: s.conditions || [] })));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchSavedSegments(); }, [fetchSavedSegments]);

  const handleSaveSegment = async () => {
    if (!segmentName.trim()) return;
    setSaving(true);
    try {
      await supabase.from('wa_broadcast_segments').insert({ name: segmentName.trim(), conditions });
      setSegmentName('');
      await fetchSavedSegments();
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const handleLoadSegment = (seg: SegmentCondition[]) => { setConditions(seg); };

  const handleDeleteSegment = async (id: string) => {
    await supabase.from('wa_broadcast_segments').delete().eq('id', id);
    await fetchSavedSegments();
  };

  return (
    <div className="wb-modal-overlay" onClick={onClose}>
      <div className="wb-modal-card wb-modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="wb-modal-header">
          <div className="wb-modal-title"><Filter size={18} /><span>Audience Segmentation Builder</span></div>
          <button onClick={onClose} className="wb-modal-close"><X size={18} /></button>
        </div>
        <div className="wb-modal-body">
          <p className="wb-modal-desc">Build precise audience segments by combining multiple conditions. Save segments for reuse across campaigns.</p>

          <div className="wb-segment-conditions">
            {conditions.map((cond, idx) => (
              <div key={idx} className="wb-segment-row">
                <span className="wb-segment-num">{idx + 1}</span>
                <select value={cond.field} onChange={(e) => { const n = [...conditions]; n[idx] = { ...cond, field: e.target.value, value: '' }; setConditions(n); }} className="wb-select">
                  {SEGMENT_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
                <select value={cond.operator} onChange={(e) => { const n = [...conditions]; n[idx] = { ...cond, operator: e.target.value }; setConditions(n); }} className="wb-select wb-segment-op">
                  {SEGMENT_OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {SEGMENT_FIELDS.find((f) => f.value === cond.field)?.type === 'select' ? (
                  <select value={cond.value} onChange={(e) => { const n = [...conditions]; n[idx] = { ...cond, value: e.target.value }; setConditions(n); }} className="wb-select">
                    <option value="">Select...</option>
                    {SEGMENT_FIELDS.find((f) => f.value === cond.field)?.options.map((o) => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
                  </select>
                ) : (
                  <input type="text" value={cond.value} onChange={(e) => { const n = [...conditions]; n[idx] = { ...cond, value: e.target.value }; setConditions(n); }} placeholder="Enter value..." className="wb-input" />
                )}
                {conditions.length > 1 && (
                  <button className="wb-segment-remove" onClick={() => setConditions(conditions.filter((_, i) => i !== idx))}><Trash2 size={12} /></button>
                )}
              </div>
            ))}
            <button className="wb-segment-add" onClick={() => setConditions([...conditions, { field: 'state', operator: 'eq', value: '' }])}>
              <Plus size={12} /> Add Condition
            </button>
          </div>

          <div className="wb-segment-count">
            {loading ? <Loader2 size={14} className="crm-spin" /> : <Users size={14} />}
            <span>{loading ? 'Counting...' : <><strong>{count.toLocaleString()}</strong> leads match this segment</>}</span>
          </div>

          <div className="wb-segment-save-bar">
            <input type="text" value={segmentName} onChange={(e) => setSegmentName(e.target.value)} placeholder="Name this segment to save it..." className="wb-input" />
            <button className="wb-action-btn wb-action-btn-primary" onClick={handleSaveSegment} disabled={!segmentName.trim() || saving}>
              {saving ? <Loader2 size={14} className="crm-spin" /> : <Save size={14} />} Save Segment
            </button>
          </div>

          {savedSegments.length > 0 && (
            <div className="wb-segment-saved">
              <h4>Saved Segments</h4>
              {savedSegments.map((seg) => (
                <div key={seg.id} className="wb-segment-saved-item">
                  <div className="wb-segment-saved-info">
                    <strong>{seg.name}</strong>
                    <span>{seg.conditions.length} condition{seg.conditions.length !== 1 ? 's' : ''}</span>
                  </div>
                  <button className="wb-action-btn wb-action-btn-ghost" onClick={() => handleLoadSegment(seg.conditions)}><Copy size={12} /> Load</button>
                  <button className="wb-action-btn wb-action-btn-danger" onClick={() => handleDeleteSegment(seg.id)}><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          )}

          <button className="wb-create-btn" onClick={() => onApply(conditions, count)} disabled={count === 0}>
            <CheckCircle2 size={16} /> Apply Segment ({count} recipients)
          </button>
        </div>
      </div>
    </div>
  );
}

// ===================== 3. Quick Recreate (Presets) =====================
export function QuickRecreatePanel({ session, broadcasts, onRecreate, onClose }: { session: Session; broadcasts: BroadcastCampaign[]; onRecreate: (config: any) => void; onClose: () => void }) {
  const [presets, setPresets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPresets = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('wa_broadcast_presets').select('*').order('created_at', { ascending: false });
      setPresets(data || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPresets(); }, [fetchPresets]);

  const handleSavePreset = async (camp: BroadcastCampaign) => {
    const name = prompt('Name this preset:', camp.campaign_name || camp.template_name);
    if (!name) return;
    try {
      await supabase.from('wa_broadcast_presets').insert({
        name,
        template_name: camp.template_name,
        template_language: camp.template_language,
        template_components: camp.template_components,
        variable_mapping: camp.variable_mapping || {},
        recipient_filter: 'all',
        phone_number_id: camp.phone_number_id,
      });
      await fetchPresets();
    } catch { /* ignore */ }
  };

  const handleDeletePreset = async (id: string) => {
    await supabase.from('wa_broadcast_presets').delete().eq('id', id);
    await fetchPresets();
  };

  const completedBroadcasts = broadcasts.filter((b) => b.status === 'completed' || b.status === 'draft');

  return (
    <div className="wb-modal-overlay" onClick={onClose}>
      <div className="wb-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="wb-modal-header">
          <div className="wb-modal-title"><Copy size={18} /><span>Quick Recreate</span></div>
          <button onClick={onClose} className="wb-modal-close"><X size={18} /></button>
        </div>
        <div className="wb-modal-body">
          <p className="wb-modal-desc">Save a broadcast configuration as a preset, then recreate it with one click — perfect for recurring broadcasts.</p>

          {presets.length > 0 && (
            <div className="wb-preset-list">
              <h4 className="wb-preset-section-title">Saved Presets</h4>
              {presets.map((p) => (
                <div key={p.id} className="wb-preset-item">
                  <div className="wb-preset-info">
                    <strong>{p.name}</strong>
                    <span>{p.template_name} - {p.template_language}</span>
                  </div>
                  <button className="wb-action-btn wb-action-btn-primary" onClick={() => onRecreate(p)}>
                    <Plus size={12} /> Recreate
                  </button>
                  <button className="wb-action-btn wb-action-btn-danger" onClick={() => handleDeletePreset(p.id)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <h4 className="wb-preset-section-title">Save from Recent Campaigns</h4>
          <div className="wb-preset-campaigns">
            {loading ? (
              <div className="wb-loading-state"><Loader2 size={20} className="crm-spin" style={{ color: '#25D366' }} /><p>Loading...</p></div>
            ) : completedBroadcasts.length === 0 ? (
              <p className="wb-analytics-empty">No completed campaigns to save as presets yet.</p>
            ) : completedBroadcasts.slice(0, 10).map((camp) => (
              <div key={camp.id} className="wb-preset-item">
                <div className="wb-preset-info">
                  <strong>{camp.campaign_name || camp.template_name}</strong>
                  <span>{camp.template_name} - {new Date(camp.created_at).toLocaleDateString()}</span>
                </div>
                <button className="wb-action-btn wb-action-btn-ghost" onClick={() => handleSavePreset(camp)}>
                  <Save size={12} /> Save as Preset
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===================== 4. A/B Test Broadcasts =====================
export function ABTestBroadcastModal({ templates, onLaunch, onClose }: { templates: { name: string; language: string }[]; onLaunch: (config: any) => void; onClose: () => void }) {
  const [name, setName] = useState('');
  const [variantA, setVariantA] = useState('');
  const [variantB, setVariantB] = useState('');
  const [split, setSplit] = useState(50);
  const [recipientFilter, setRecipientFilter] = useState('all');

  return (
    <div className="wb-modal-overlay" onClick={onClose}>
      <div className="wb-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="wb-modal-header">
          <div className="wb-modal-title"><FlaskConical size={18} /><span>A/B Test Broadcast</span></div>
          <button onClick={onClose} className="wb-modal-close"><X size={18} /></button>
        </div>
        <div className="wb-modal-body">
          <p className="wb-modal-desc">Send two template variants to different groups and compare performance. The system splits recipients automatically based on your percentage.</p>

          <label className="wb-field">
            <span>Test Name <em>*</em></span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Welcome Message Test" className="wb-input" />
          </label>

          <div className="wb-abtest-variants">
            <div className="wb-abtest-variant">
              <span className="wb-abtest-variant-label">Variant A</span>
              <select value={variantA} onChange={(e) => setVariantA(e.target.value)} className="wb-select">
                <option value="">Select template...</option>
                {templates.map((t) => <option key={t.name} value={t.name}>{t.name} ({t.language})</option>)}
              </select>
            </div>
            <div className="wb-abtest-variant">
              <span className="wb-abtest-variant-label">Variant B</span>
              <select value={variantB} onChange={(e) => setVariantB(e.target.value)} className="wb-select">
                <option value="">Select template...</option>
                {templates.map((t) => <option key={t.name} value={t.name}>{t.name} ({t.language})</option>)}
              </select>
            </div>
          </div>

          <div className="wb-abtest-split">
            <span>Split: <strong>{split}%</strong> A / <strong>{100 - split}%</strong> B</span>
            <input type="range" min="10" max="90" value={split} step="10" onChange={(e) => setSplit(parseInt(e.target.value))} className="wb-abtest-slider" />
          </div>

          <label className="wb-field">
            <span>Recipient Filter</span>
            <select value={recipientFilter} onChange={(e) => setRecipientFilter(e.target.value)} className="wb-select">
              <option value="all">All Leads</option>
              <option value="new">New</option>
              <option value="interested">Interested</option>
              <option value="called_responded">Called - Responded</option>
            </select>
          </label>

          <button className="wb-create-btn" onClick={() => onLaunch({ name, variantA, variantB, split, recipientFilter })} disabled={!name.trim() || !variantA || !variantB || variantA === variantB}>
            <FlaskConical size={16} /> Launch A/B Test
          </button>
        </div>
      </div>
    </div>
  );
}

// ===================== 5. Send-Time Optimization =====================
export function SendTimeOptimization({ broadcasts, onApply, onClose }: { broadcasts: BroadcastCampaign[]; onApply: (time: string) => void; onClose: () => void }) {
  const hourlyPerf: Record<number, { sent: number; read: number }> = {};
  broadcasts.filter((b) => b.status === 'completed').forEach((b) => {
    const hour = new Date(b.created_at).getHours();
    if (!hourlyPerf[hour]) hourlyPerf[hour] = { sent: 0, read: 0 };
    hourlyPerf[hour].sent += b.sent_count;
    hourlyPerf[hour].read += b.read_count || 0;
  });

  const rankedHours = Object.entries(hourlyPerf)
    .map(([h, d]) => ({ hour: parseInt(h), rate: d.sent > 0 ? Math.round((d.read / d.sent) * 100) : 0, sent: d.sent }))
    .filter((h) => h.sent >= 10)
    .sort((a, b) => b.rate - a.rate);

  const bestHour = rankedHours[0];
  const maxRate = rankedHours[0]?.rate || 100;

  return (
    <div className="wb-modal-overlay" onClick={onClose}>
      <div className="wb-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="wb-modal-header">
          <div className="wb-modal-title"><Clock3 size={18} /><span>Send-Time Optimization</span></div>
          <button onClick={onClose} className="wb-modal-close"><X size={18} /></button>
        </div>
        <div className="wb-modal-body">
          <p className="wb-modal-desc">Analyzes your past campaign data to find the hours when recipients are most likely to read your messages.</p>

          {rankedHours.length === 0 ? (
            <div className="wb-empty-state"><Clock3 size={36} style={{ opacity: 0.25, marginBottom: 8 }} /><p>Not enough data yet. Send a few broadcasts first to unlock send-time recommendations.</p></div>
          ) : (
            <>
              {bestHour && (
                <div className="wb-sto-best">
                  <Zap size={16} />
                  <span>Best time to send: <strong>{bestHour.hour}:00 - {bestHour.hour + 1}:00</strong> ({bestHour.rate}% read rate)</span>
                </div>
              )}
              <div className="wb-sto-chart">
                {rankedHours.map((h) => (
                  <div key={h.hour} className="wb-sto-bar-row">
                    <span className="wb-sto-hour">{h.hour}:00</span>
                    <div className="wb-sto-bar-track">
                      <div className="wb-sto-bar-fill" style={{ width: `${(h.rate / maxRate) * 100}%` }}>
                        <span>{h.rate}%</span>
                      </div>
                    </div>
                    <span className="wb-sto-sent">{h.sent} sent</span>
                  </div>
                ))}
              </div>
              {bestHour && (
                <button className="wb-create-btn" onClick={() => onApply(`${String(bestHour.hour).padStart(2, '0')}:00`)}>
                  <Calendar size={16} /> Schedule Next Broadcast at {bestHour.hour}:00
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ===================== 6. Throttle Control =====================
export function ThrottleControl({ currentDelay, onChange }: { currentDelay: number; onChange: (delay: number) => void }) {
  const presets = [
    { label: 'Fast', delay: 200, desc: '200ms - fastest, higher risk' },
    { label: 'Balanced', delay: 500, desc: '500ms - recommended default' },
    { label: 'Safe', delay: 1000, desc: '1s - slower, safer for new accounts' },
    { label: 'Ultra Safe', delay: 2000, desc: '2s - very slow, lowest risk' },
  ];
  const activePreset = presets.find((p) => p.delay === currentDelay);

  return (
    <div className="wb-throttle-panel">
      <div className="wb-throttle-header"><Gauge size={14} /><span>Send Throttling</span></div>
      <div className="wb-throttle-presets">
        {presets.map((p) => (
          <button
            key={p.delay}
            className={`wb-throttle-preset ${currentDelay === p.delay ? 'active' : ''}`}
            onClick={() => onChange(p.delay)}
          >
            <strong>{p.label}</strong>
            <span>{p.desc}</span>
          </button>
        ))}
      </div>
      <div className="wb-throttle-custom">
        <label>
          Custom delay (ms):
          <input type="number" value={currentDelay} min="100" max="5000" step="100" onChange={(e) => onChange(parseInt(e.target.value) || 500)} className="wb-input" />
        </label>
      </div>
      {activePreset && (
        <div className="wb-throttle-info">
          <Activity size={12} />
          <span>{activePreset.desc}</span>
        </div>
      )}
    </div>
  );
}

// ===================== 7. Reply Tracking =====================
export function ReplyTrackingPanel({ broadcasts, onClose }: { broadcasts: BroadcastCampaign[]; onClose: () => void }) {
  const [replyData, setReplyData] = useState<Record<string, { replies: number; total: number }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const data: Record<string, { replies: number; total: number }> = {};
      for (const camp of broadcasts.filter((b) => b.status === 'completed')) {
        try {
          const { data: recipients } = await supabase.from('wa_broadcast_recipients')
            .select('lead_id, status')
            .eq('campaign_id', camp.id)
            .not('lead_id', 'is', null);
          const leadIds = (recipients || []).map((r: any) => r.lead_id).filter(Boolean);
          if (leadIds.length === 0) { data[camp.id] = { replies: 0, total: camp.total_recipients }; continue; }
          const { count } = await supabase.from('wa_messages')
            .select('*', { count: 'exact', head: true })
            .in('lead_id', leadIds)
            .eq('direction', 'inbound')
            .gte('created_at', camp.created_at);
          data[camp.id] = { replies: count || 0, total: camp.total_recipients };
        } catch { data[camp.id] = { replies: 0, total: camp.total_recipients }; }
      }
      setReplyData(data);
      setLoading(false);
    })();
  }, [broadcasts]);

  const campaigns = broadcasts.filter((b) => b.status === 'completed');
  const totalReplies = Object.values(replyData).reduce((s, d) => s + d.replies, 0);
  const totalSent = Object.values(replyData).reduce((s, d) => s + d.total, 0);
  const overallRate = totalSent > 0 ? ((totalReplies / totalSent) * 100).toFixed(1) : '0';

  return (
    <div className="wb-modal-overlay" onClick={onClose}>
      <div className="wb-modal-card wb-modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="wb-modal-header">
          <div className="wb-modal-title"><MessageCircle size={18} /><span>Reply Tracking</span></div>
          <button onClick={onClose} className="wb-modal-close"><X size={18} /></button>
        </div>
        <div className="wb-modal-body">
          {loading ? (
            <div className="wb-loading-state"><Loader2 size={24} className="crm-spin" style={{ color: '#25D366' }} /><p>Analyzing replies across campaigns...</p></div>
          ) : (
            <>
              <div className="wb-reply-summary">
                <div className="wb-reply-stat"><MessageCircle size={18} /><strong>{totalReplies}</strong><span>Total Replies</span></div>
                <div className="wb-reply-stat"><Activity size={18} style={{ color: '#25D366' }} /><strong>{overallRate}%</strong><span>Overall Reply Rate</span></div>
                <div className="wb-reply-stat"><Send size={18} /><strong>{totalSent.toLocaleString()}</strong><span>Messages Sent</span></div>
              </div>
              <div className="wb-reply-list">
                {campaigns.length === 0 ? (
                  <p className="wb-analytics-empty">No completed campaigns to analyze yet.</p>
                ) : campaigns.map((camp) => {
                  const d = replyData[camp.id] || { replies: 0, total: 0 };
                  const rate = d.total > 0 ? ((d.replies / d.total) * 100).toFixed(1) : '0';
                  return (
                    <div key={camp.id} className="wb-reply-item">
                      <div className="wb-reply-info">
                        <strong>{camp.campaign_name || camp.template_name}</strong>
                        <span>{camp.template_name} - {new Date(camp.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="wb-reply-stats">
                        <span className="wb-reply-count">{d.replies} replies</span>
                        <span className="wb-reply-rate-badge">{rate}% reply rate</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ===================== 8. Cost Estimator =====================
export function CostEstimator({ recipientCount, onClose }: { recipientCount: number; onClose: () => void }) {
  const [costPerMessage, setCostPerMessage] = useState(0.0085); // WhatsApp India marketing avg
  const tiers = [
    { label: 'India Marketing', cost: 0.0085 },
    { label: 'India Utility', cost: 0.0042 },
    { label: 'India Authentication', cost: 0.0013 },
    { label: 'US Marketing', cost: 0.025 },
    { label: 'UK Marketing', cost: 0.030 },
  ];
  const totalCost = (recipientCount * costPerMessage).toFixed(2);

  return (
    <div className="wb-modal-overlay" onClick={onClose}>
      <div className="wb-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="wb-modal-header">
          <div className="wb-modal-title"><DollarSign size={18} /><span>Cost Estimator</span></div>
          <button onClick={onClose} className="wb-modal-close"><X size={18} /></button>
        </div>
        <div className="wb-modal-body">
          <p className="wb-modal-desc">Estimate the cost of your broadcast based on WhatsApp's per-message pricing. Actual costs vary by country and conversation category.</p>

          <div className="wb-cost-tiers">
            {tiers.map((t) => (
              <button key={t.label} className={`wb-cost-tier ${costPerMessage === t.cost ? 'active' : ''}`} onClick={() => setCostPerMessage(t.cost)}>
                <strong>{t.label}</strong>
                <span>${t.cost.toFixed(4)} / msg</span>
              </button>
            ))}
          </div>

          <div className="wb-cost-custom">
            <label>Custom cost per message ($):
              <input type="number" value={costPerMessage} step="0.0001" min="0" onChange={(e) => setCostPerMessage(parseFloat(e.target.value) || 0)} className="wb-input" />
            </label>
          </div>

          <div className="wb-cost-result">
            <div className="wb-cost-row"><span>Recipients</span><strong>{recipientCount.toLocaleString()}</strong></div>
            <div className="wb-cost-row"><span>Cost per message</span><strong>${costPerMessage.toFixed(4)}</strong></div>
            <div className="wb-cost-row wb-cost-total"><span>Estimated total cost</span><strong>${totalCost}</strong></div>
          </div>

          <div className="wb-warn-box">
            <AlertTriangle size={16} />
            <div>This is an estimate only. Actual WhatsApp pricing depends on the recipient's country code, conversation category (marketing/utility/authentication), and whether a conversation window is already open. Check <strong>Meta Business Manager</strong> for exact pricing.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===================== 9. Campaign Comparison =====================
export function CampaignComparison({ broadcasts, onClose }: { broadcasts: BroadcastCampaign[]; onClose: () => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const completed = broadcasts.filter((b) => b.status === 'completed');

  const toggle = (id: string) => {
    setSelected((prev) => prev.length >= 5 && !prev.includes(id) ? prev : prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const selectedCamps = completed.filter((c) => selected.includes(c.id));

  return (
    <div className="wb-modal-overlay" onClick={onClose}>
      <div className="wb-modal-card wb-modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="wb-modal-header">
          <div className="wb-modal-title"><GitCompare size={18} /><span>Campaign Comparison</span></div>
          <button onClick={onClose} className="wb-modal-close"><X size={18} /></button>
        </div>
        <div className="wb-modal-body">
          <p className="wb-modal-desc">Select 2-5 completed campaigns to compare performance side by side.</p>

          <div className="wb-compare-select">
            {completed.length === 0 ? (
              <p className="wb-analytics-empty">No completed campaigns to compare yet.</p>
            ) : completed.map((camp) => (
              <label key={camp.id} className={`wb-compare-option ${selected.includes(camp.id) ? 'selected' : ''}`}>
                <input type="checkbox" checked={selected.includes(camp.id)} onChange={() => toggle(camp.id)} />
                <span>{camp.campaign_name || camp.template_name}</span>
                <small>{camp.template_name} - {new Date(camp.created_at).toLocaleDateString()}</small>
              </label>
            ))}
          </div>

          {selectedCamps.length >= 2 && (
            <div className="wb-compare-table-wrap">
              <table className="wb-table wb-compare-table">
                <thead><tr><th>Metric</th>{selectedCamps.map((c) => <th key={c.id}>{c.campaign_name || c.template_name}</th>)}</tr></thead>
                <tbody>
                  <tr><td>Total Recipients</td>{selectedCamps.map((c) => <td key={c.id}>{c.total_recipients.toLocaleString()}</td>)}</tr>
                  <tr><td>Sent</td>{selectedCamps.map((c) => <td key={c.id}>{c.sent_count.toLocaleString()}</td>)}</tr>
                  <tr><td>Delivered</td>{selectedCamps.map((c) => <td key={c.id}>{c.delivered_count.toLocaleString()}</td>)}</tr>
                  <tr><td>Read</td>{selectedCamps.map((c) => <td key={c.id}>{(c.read_count || 0).toLocaleString()}</td>)}</tr>
                  <tr><td>Failed</td>{selectedCamps.map((c) => <td key={c.id}>{c.failed_count.toLocaleString()}</td>)}</tr>
                  <tr><td>Delivery Rate</td>{selectedCamps.map((c) => <td key={c.id}>{c.sent_count > 0 ? Math.round((c.delivered_count / c.sent_count) * 100) : 0}%</td>)}</tr>
                  <tr><td>Read Rate</td>{selectedCamps.map((c) => <td key={c.id}>{c.delivered_count > 0 ? Math.round(((c.read_count || 0) / c.delivered_count) * 100) : 0}%</td>)}</tr>
                  <tr><td>Fail Rate</td>{selectedCamps.map((c) => <td key={c.id}>{c.sent_count > 0 ? Math.round((c.failed_count / c.sent_count) * 100) : 0}%</td>)}</tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===================== 10. Calendar View =====================
export function BroadcastCalendarView({ broadcasts, onSelect, onClose }: { broadcasts: BroadcastCampaign[]; onSelect: (camp: BroadcastCampaign) => void; onClose: () => void }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const today = new Date();
  const viewDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const campsByDate: Record<string, BroadcastCampaign[]> = {};
  broadcasts.forEach((b) => {
    const d = new Date(b.scheduled_at || b.created_at);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const key = `${d.getDate()}`;
      if (!campsByDate[key]) campsByDate[key] = [];
      campsByDate[key].push(b);
    }
  });

  const monthName = viewDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const statusColors: Record<string, string> = { completed: '#16a34a', sending: '#2563eb', failed: '#dc2626', draft: '#854d0e', scheduled: '#7c3aed' };

  return (
    <div className="wb-modal-overlay" onClick={onClose}>
      <div className="wb-modal-card wb-modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="wb-modal-header">
          <div className="wb-modal-title"><CalendarDays size={18} /><span>Broadcast Calendar</span></div>
          <button onClick={onClose} className="wb-modal-close"><X size={18} /></button>
        </div>
        <div className="wb-modal-body">
          <div className="wb-cal-nav">
            <button className="wb-action-btn wb-action-btn-ghost" onClick={() => setMonthOffset(monthOffset - 1)}>Previous</button>
            <strong>{monthName}</strong>
            <button className="wb-action-btn wb-action-btn-ghost" onClick={() => setMonthOffset(monthOffset + 1)}>Next</button>
          </div>
          <div className="wb-cal-grid">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="wb-cal-dow">{d}</div>)}
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} className="wb-cal-empty" />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const camps = campsByDate[String(day)] || [];
              const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              return (
                <div key={day} className={`wb-cal-day ${isToday ? 'wb-cal-today' : ''} ${camps.length > 0 ? 'wb-cal-has-events' : ''}`}>
                  <span className="wb-cal-day-num">{day}</span>
                  {camps.slice(0, 3).map((c) => (
                    <div key={c.id} className="wb-cal-event" style={{ borderLeftColor: statusColors[c.status] || '#64748b' }} onClick={() => onSelect(c)}>
                      <span>{c.campaign_name || c.template_name}</span>
                    </div>
                  ))}
                  {camps.length > 3 && <span className="wb-cal-more">+{camps.length - 3} more</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
