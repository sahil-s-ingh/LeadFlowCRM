import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, XCircle, TrendingDown, Tag, BarChart3 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

interface Lead {
  id: string;
  full_name: string;
  status: string;
  email: string;
  fund_amount: number | null;
  created_at: string;
  assigned_to?: string | null;
}

interface WinLossReason {
  id: string;
  lead_id: string;
  outcome: 'won' | 'lost';
  reason_category: string;
  reason_detail: string | null;
  created_at: string;
}

interface WinLossAnalysisProps {
  session: Session;
  leads: Lead[];
  onBack: () => void;
}

const LOSS_CATEGORIES = [
  { key: 'price', label: 'Too Expensive' },
  { key: 'timing', label: 'Bad Timing' },
  { key: 'competitor', label: 'Chose Competitor' },
  { key: 'not_interested', label: 'Lost Interest' },
  { key: 'unreachable', label: 'Unreachable' },
  { key: 'budget', label: 'No Budget' },
  { key: 'other', label: 'Other' },
];

const WIN_CATEGORIES = [
  { key: 'good_fit', label: 'Great Product Fit' },
  { key: 'competitive_price', label: 'Competitive Price' },
  { key: 'trust', label: 'Built Trust' },
  { key: 'timing', label: 'Perfect Timing' },
  { key: 'referral', label: 'Referred by Friend' },
  { key: 'follow_up', label: 'Persistent Follow-Up' },
  { key: 'other', label: 'Other' },
];

export default function WinLossAnalysis({ session, leads, onBack }: WinLossAnalysisProps) {
  const [reasons, setReasons] = useState<WinLossReason[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'lost' | 'won'>('lost');
  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [detail, setDetail] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('win_loss_reasons')
        .select('id, lead_id, outcome, reason_category, reason_detail, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });
      setReasons((data || []) as WinLossReason[]);
      setLoading(false);
    })();
  }, [session.user.id]);

  const wonLeads = useMemo(() => leads.filter((l) => l.status === 'converted'), [leads]);
  const lostLeads = useMemo(() => leads.filter((l) => l.status === 'not_interested'), [leads]);
  const activeLeads = tab === 'lost' ? lostLeads : wonLeads;
  const activeReasons = reasons.filter((r) => r.outcome === tab);
  const categories = tab === 'lost' ? LOSS_CATEGORIES : WIN_CATEGORIES;

  const taggedLeadIds = new Set(activeReasons.map((r) => r.lead_id));
  const untaggedLeads = activeLeads.filter((l) => !taggedLeadIds.has(l.id));

  const categoryStats = useMemo(() => {
    const map: Record<string, number> = {};
    activeReasons.forEach((r) => {
      map[r.reason_category] = (map[r.reason_category || 0] || 0) + 1;
    });
    return Object.entries(map)
      .map(([key, count]) => {
        const cat = categories.find((c) => c.key === key);
        return { key, label: cat?.label || key, count };
      })
      .sort((a, b) => b.count - a.count);
  }, [activeReasons, categories]);

  const maxCount = Math.max(...categoryStats.map((c) => c.count), 1);

  const saveReason = async () => {
    if (!selectedLead || !selectedCategory) return;
    const { data } = await supabase
      .from('win_loss_reasons')
      .insert({
        user_id: session.user.id,
        lead_id: selectedLead,
        outcome: tab,
        reason_category: selectedCategory,
        reason_detail: detail || null,
      })
      .select('id, lead_id, outcome, reason_category, reason_detail, created_at')
      .maybeSingle();
    if (data) {
      setReasons((prev) => [data as WinLossReason, ...prev]);
    }
    setSelectedLead(null);
    setSelectedCategory('');
    setDetail('');
    setShowAdd(false);
  };

  const leadName = (leadId: string) => {
    const lead = leads.find((l) => l.id === leadId);
    return lead?.full_name || 'Unknown';
  };

  return (
    <div className="dash-overview">
      <div className="dash-page-header">
        <button className="dash-back-btn" onClick={onBack}><ArrowLeft size={18} /> Back</button>
        <h1>Win / Loss Analysis</h1>
        <p>Understand why leads convert or slip away</p>
      </div>

      <div className="dash-winloss-tabs">
        <button
          className={`dash-winloss-tab ${tab === 'lost' ? 'active dash-winloss-tab-red' : ''}`}
          onClick={() => { setTab('lost'); setShowAdd(false); }}
        >
          <XCircle size={16} /> Lost Leads ({lostLeads.length})
        </button>
        <button
          className={`dash-winloss-tab ${tab === 'won' ? 'active dash-winloss-tab-green' : ''}`}
          onClick={() => { setTab('won'); setShowAdd(false); }}
        >
          <CheckCircle2 size={16} /> Won Deals ({wonLeads.length})
        </button>
      </div>

      {loading ? (
        <div className="dash-overview-loading">
          <div className="dash-loading-spinner" />
          <p>Loading analysis...</p>
        </div>
      ) : (
        <div className="dash-two-col">
          {/* Category breakdown */}
          <div className="dash-card">
            <div className="dash-card-header">
              <div className="dash-card-title">
                <div className={`dash-card-icon ${tab === 'lost' ? 'dash-card-icon-red' : 'dash-card-icon-green'}`}>
                  <BarChart3 size={18} />
                </div>
                <h2>Reason Breakdown</h2>
              </div>
              <span className="dash-pipeline-total-badge">{activeReasons.length} tagged</span>
            </div>
            {categoryStats.length === 0 ? (
              <div className="dash-recent-empty">
                <Tag size={32} />
                <p>No reasons tagged yet</p>
              </div>
            ) : (
              <div className="dash-winloss-breakdown">
                {categoryStats.map((cat) => (
                  <div key={cat.key} className="dash-winloss-bar-row">
                    <span className="dash-winloss-bar-label">{cat.label}</span>
                    <div className="dash-winloss-bar-track">
                      <div
                        className={`dash-winloss-bar-fill ${tab === 'lost' ? 'dash-winloss-fill-red' : 'dash-winloss-fill-green'}`}
                        style={{ width: `${(cat.count / maxCount) * 100}%` }}
                      />
                    </div>
                    <span className="dash-winloss-bar-count">{cat.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tagged leads list */}
          <div className="dash-card">
            <div className="dash-card-header">
              <div className="dash-card-title">
                <div className="dash-card-icon dash-card-icon-amber"><Tag size={18} /></div>
                <h2>{tab === 'lost' ? 'Lost' : 'Won'} Records</h2>
              </div>
              <button
                className="dash-card-link"
                onClick={() => { setShowAdd(!showAdd); setSelectedLead(null); setSelectedCategory(''); setDetail(''); }}
              >
                {showAdd ? 'Cancel' : '+ Add Tag'}
              </button>
            </div>

            {showAdd && untaggedLeads.length > 0 && (
              <div className="dash-winloss-add-form">
                <select
                  className="dash-winloss-select"
                  value={selectedLead || ''}
                  onChange={(e) => setSelectedLead(e.target.value)}
                >
                  <option value="">Select a lead...</option>
                  {untaggedLeads.map((l) => (
                    <option key={l.id} value={l.id}>{l.full_name}</option>
                  ))}
                </select>
                <select
                  className="dash-winloss-select"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  disabled={!selectedLead}
                >
                  <option value="">Select a reason...</option>
                  {categories.map((c) => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  className="dash-winloss-input"
                  placeholder="Optional detail..."
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                />
                <button
                  className="dash-winloss-save-btn"
                  onClick={saveReason}
                  disabled={!selectedLead || !selectedCategory}
                >
                  Save
                </button>
              </div>
            )}

            {showAdd && untaggedLeads.length === 0 && (
              <div className="dash-winloss-add-form">
                <p className="dash-winloss-no-leads">All {tab === 'lost' ? 'lost' : 'won'} leads have been tagged.</p>
              </div>
            )}

            <div className="dash-recent-list">
              {activeReasons.length === 0 ? (
                <div className="dash-recent-empty">
                  <Tag size={32} />
                  <p>No {tab === 'lost' ? 'loss' : 'win'} reasons recorded yet</p>
                </div>
              ) : (
                activeReasons.map((r) => {
                  const cat = categories.find((c) => c.key === r.reason_category);
                  return (
                    <div key={r.id} className="dash-recent-row">
                      <div
                        className={`dash-recent-avatar ${tab === 'lost' ? 'dash-winloss-avatar-red' : 'dash-winloss-avatar-green'}`}
                      >
                        {tab === 'lost' ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
                      </div>
                      <div className="dash-recent-info">
                        <div className="dash-recent-name">{leadName(r.lead_id)}</div>
                        <div className="dash-recent-meta">{cat?.label || r.reason_category}{r.reason_detail ? ` · ${r.reason_detail}` : ''}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
