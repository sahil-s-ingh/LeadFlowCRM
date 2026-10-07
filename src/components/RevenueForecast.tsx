import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import {
  ArrowLeft, RefreshCw, Loader2, TrendingUp, DollarSign,
  Target, BarChart3, PieChart, Activity, AlertTriangle,
  CheckCircle2, Clock, Zap,
} from 'lucide-react';

interface RevenueForecastProps {
  session: Session;
  onBack: () => void;
}

type LeadStatus = 'new' | 'called_no_response' | 'called_responded' | 'interested' | 'not_interested' | 'converted';

interface LeadRow {
  id: string;
  status: LeadStatus;
  fund_amount: number | null;
  created_at: string;
}

const STAGE_ORDER: LeadStatus[] = ['new', 'called_no_response', 'called_responded', 'interested', 'converted'];
const STAGE_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  called_no_response: 'Called — No Response',
  called_responded: 'Called — Responded',
  interested: 'Interested',
  not_interested: 'Not Interested',
  converted: 'Converted',
};
const STAGE_COLORS: Record<LeadStatus, string> = {
  new: '#3B82F6',
  called_no_response: '#F59E0B',
  called_responded: '#06B6D4',
  interested: '#8B5CF6',
  not_interested: '#9CA3AF',
  converted: '#16A34A',
};

export default function RevenueForecast({ session, onBack }: RevenueForecastProps) {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [setupCost, setSetupCost] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [leadsRes, settingsRes] = await Promise.all([
        supabase.from('submissions').select('id, status, fund_amount, created_at').is('deleted_at', null).limit(5000),
        supabase.from('appearance_settings').select('setup_cost').maybeSingle(),
      ]);
      setLeads((leadsRes.data || []) as LeadRow[]);
      setSetupCost(typeof settingsRes.data?.setup_cost === 'number' ? settingsRes.data.setup_cost : 0);
    } catch (err) {
      console.error('Failed to load forecast data:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const forecast = useMemo(() => {
    const stageCounts: Record<string, number> = {};
    const stageFunds: Record<string, number> = {};
    let totalFunds = 0;
    let convertedFunds = 0;
    let convertedCount = 0;
    let lostCount = 0;

    leads.forEach((lead) => {
      const status = lead.status;
      const fund = lead.fund_amount ? parseFloat(String(lead.fund_amount)) : 0;
      stageCounts[status] = (stageCounts[status] || 0) + 1;
      stageFunds[status] = (stageFunds[status] || 0) + fund;
      totalFunds += fund;
      if (status === 'converted') {
        convertedFunds += fund;
        convertedCount++;
      }
      if (status === 'not_interested') {
        lostCount++;
      }
    });

    // Compute stage-to-stage conversion rates from historical data
    const stageRates: Record<string, number> = {};
    for (let i = 0; i < STAGE_ORDER.length - 1; i++) {
      const current = STAGE_ORDER[i];
      const remaining = STAGE_ORDER.slice(i + 1).filter((s) => s !== 'not_interested');
      const advanced = remaining.reduce((sum, s) => sum + (stageCounts[s] || 0), 0);
      const total = (stageCounts[current] || 0) + advanced;
      stageRates[current] = total > 0 ? advanced / total : 0;
    }

    // Weighted expected revenue per stage = funds in stage × probability of conversion
    // Probability = product of all remaining stage conversion rates
    const stageProbabilities: Record<string, number> = {};
    STAGE_ORDER.forEach((stage, idx) => {
      if (stage === 'converted') {
        stageProbabilities[stage] = 1;
        return;
      }
      let prob = 1;
      for (let i = idx; i < STAGE_ORDER.length - 1; i++) {
        prob *= stageRates[STAGE_ORDER[i]] || 0;
      }
      stageProbabilities[stage] = prob;
    });

    const stageExpectedRevenue: Record<string, number> = {};
    STAGE_ORDER.forEach((stage) => {
      stageExpectedRevenue[stage] = (stageFunds[stage] || 0) * stageProbabilities[stage];
    });

    const expectedRevenue = Object.values(stageExpectedRevenue).reduce((a, b) => a + b, 0);
    const realizedRevenue = convertedFunds;
    const potentialRevenue = totalFunds - convertedFunds;
    const setupRevenue = convertedCount * setupCost;
    const totalPipelineValue = totalFunds + setupRevenue;

    // Monthly projection based on average conversion velocity
    // Calculate how many leads converted per day (from created_at to now)
    const now = Date.now();
    const convertedLeads = leads.filter((l) => l.status === 'converted');
    let avgConversionDays = 30; // default
    if (convertedLeads.length > 0) {
      const totalDays = convertedLeads.reduce((sum, l) => {
        const days = Math.max(1, (now - new Date(l.created_at).getTime()) / 86400000);
        return sum + days;
      }, 0);
      avgConversionDays = totalDays / convertedLeads.length;
    }

    const monthlyProjection = expectedRevenue / Math.max(1, avgConversionDays / 30);

    return {
      stageCounts,
      stageFunds,
      stageRates,
      stageProbabilities,
      stageExpectedRevenue,
      expectedRevenue,
      realizedRevenue,
      potentialRevenue,
      setupRevenue,
      totalPipelineValue,
      convertedCount,
      lostCount,
      totalLeads: leads.length,
      monthlyProjection,
      avgConversionDays,
    };
  }, [leads, setupCost]);

  const formatCurrency = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return `${n.toFixed(0)}`;
  };

  const maxStageFunds = Math.max(...STAGE_ORDER.map((s) => forecast.stageFunds[s] || 0), 1);

  return (
    <div className="ea-container">
      <div className="ea-header">
        <div className="ea-header-left">
          <button className="ea-back-btn" onClick={onBack}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="ea-title">Revenue Forecast</h1>
            <p className="ea-subtitle">Projected revenue based on your pipeline conversion rates and deal values</p>
          </div>
        </div>
        <div className="ea-header-actions">
          <button className="ea-refresh-btn" onClick={fetchData} disabled={loading}>
            {loading ? <Loader2 size={16} className="crm-spin" /> : <RefreshCw size={16} />}
            Refresh
          </button>
        </div>
      </div>

      {/* Hero Revenue Cards */}
      <div className="ea-stats-grid">
        <div className="ea-stat-card ea-stat-green">
          <div className="ea-stat-glow" />
          <div className="ea-stat-top">
            <div className="ea-stat-icon-wrap"><DollarSign size={22} /></div>
          </div>
          <span className="ea-stat-value">{formatCurrency(forecast.expectedRevenue)}</span>
          <span className="ea-stat-label">Expected Revenue</span>
        </div>
        <div className="ea-stat-card ea-stat-blue">
          <div className="ea-stat-glow" />
          <div className="ea-stat-top">
            <div className="ea-stat-icon-wrap"><CheckCircle2 size={22} /></div>
          </div>
          <span className="ea-stat-value">{formatCurrency(forecast.realizedRevenue)}</span>
          <span className="ea-stat-label">Realized (Converted)</span>
        </div>
        <div className="ea-stat-card ea-stat-violet">
          <div className="ea-stat-glow" />
          <div className="ea-stat-top">
            <div className="ea-stat-icon-wrap"><TrendingUp size={22} /></div>
          </div>
          <span className="ea-stat-value">{formatCurrency(forecast.potentialRevenue)}</span>
          <span className="ea-stat-label">Potential (In Pipeline)</span>
        </div>
        <div className="ea-stat-card ea-stat-cyan">
          <div className="ea-stat-glow" />
          <div className="ea-stat-top">
            <div className="ea-stat-icon-wrap"><Zap size={22} /></div>
          </div>
          <span className="ea-stat-value">{formatCurrency(forecast.monthlyProjection)}</span>
          <span className="ea-stat-label">Monthly Projection</span>
        </div>
        <div className="ea-stat-card ea-stat-red">
          <div className="ea-stat-glow" />
          <div className="ea-stat-top">
            <div className="ea-stat-icon-wrap"><Target size={22} /></div>
          </div>
          <span className="ea-stat-value">{formatCurrency(forecast.totalPipelineValue)}</span>
          <span className="ea-stat-label">Total Pipeline Value</span>
        </div>
      </div>

      <div className="ea-charts-row">
        {/* Stage Breakdown */}
        <div className="ea-card ea-card-elevated">
          <div className="ea-card-header">
            <div className="ea-card-title">
              <div className="ea-card-icon ea-card-icon-blue"><BarChart3 size={18} /></div>
              <h2>Pipeline Revenue by Stage</h2>
            </div>
          </div>
          <div style={{ padding: '20px' }}>
            {STAGE_ORDER.filter((s) => s !== 'not_interested').map((stage) => {
              const funds = forecast.stageFunds[stage] || 0;
              const expected = forecast.stageExpectedRevenue[stage] || 0;
              const prob = forecast.stageProbabilities[stage] || 0;
              const count = forecast.stageCounts[stage] || 0;
              const widthPct = maxStageFunds > 0 ? (funds / maxStageFunds) * 100 : 0;
              return (
                <div key={stage} style={{ marginBottom: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: STAGE_COLORS[stage], display: 'inline-block' }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1f2937' }}>{STAGE_LABELS[stage]}</span>
                      <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>({count} leads)</span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>{Math.round(prob * 100)}% likely</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: STAGE_COLORS[stage] }}>{formatCurrency(funds)}</span>
                    </div>
                  </div>
                  <div style={{ height: '10px', background: 'rgba(0,0,0,0.05)', borderRadius: '6px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${widthPct}%`, background: STAGE_COLORS[stage], borderRadius: '6px', transition: 'width 0.5s ease' }} />
                  </div>
                  <div style={{ marginTop: '4px', fontSize: '0.72rem', color: '#9ca3af' }}>
                    Expected: <strong style={{ color: '#4b5563' }}>{formatCurrency(expected)}</strong>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Conversion Rates */}
        <div className="ea-card ea-card-elevated">
          <div className="ea-card-header">
            <div className="ea-card-title">
              <div className="ea-card-icon ea-card-icon-violet"><PieChart size={18} /></div>
              <h2>Stage Conversion Rates</h2>
            </div>
          </div>
          <div style={{ padding: '20px' }}>
            {STAGE_ORDER.slice(0, -1).map((stage, idx) => {
              const rate = forecast.stageRates[stage] || 0;
              const nextStage = STAGE_ORDER[idx + 1];
              return (
                <div key={stage} style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.82rem', color: '#4b5563' }}>
                      {STAGE_LABELS[stage]} → {STAGE_LABELS[nextStage]}
                    </span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: rate > 0.4 ? '#16a34a' : rate > 0.2 ? '#f59e0b' : '#dc2626' }}>
                      {Math.round(rate * 100)}%
                    </span>
                  </div>
                  <div style={{ height: '8px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${rate * 100}%`,
                      background: rate > 0.4 ? '#16a34a' : rate > 0.2 ? '#f59e0b' : '#dc2626',
                      borderRadius: '4px',
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                </div>
              );
            })}
            <div style={{ marginTop: '20px', padding: '14px', background: 'rgba(37,99,235,0.05)', borderRadius: '10px', border: '1px solid rgba(37,99,235,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Activity size={15} style={{ color: '#2563eb' }} />
                <strong style={{ fontSize: '0.82rem', color: '#1f2937' }}>Forecast Insights</strong>
              </div>
              <p style={{ fontSize: '0.78rem', color: '#6b7280', lineHeight: 1.5 }}>
                Average time to conversion: <strong>{Math.round(forecast.avgConversionDays)} days</strong>.
                At current rates, you're projected to earn <strong>{formatCurrency(forecast.monthlyProjection)}</strong> per month.
                Your biggest bottleneck is{' '}
                <strong>
                  {STAGE_LABELS[STAGE_ORDER.reduce((min, s, i) => {
                    const r = forecast.stageRates[s] || 0;
                    return r < (forecast.stageRates[STAGE_ORDER[min]] || 1) ? i : min;
                  }, 0)]}
                </strong>
                .
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Summary */}
      <div className="ea-card ea-card-elevated" style={{ marginTop: '20px' }}>
        <div className="ea-card-header">
          <div className="ea-card-title">
            <div className="ea-card-icon ea-card-icon-green"><DollarSign size={18} /></div>
            <h2>Revenue Summary</h2>
          </div>
        </div>
        <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div style={{ padding: '16px', background: 'rgba(22,163,74,0.05)', borderRadius: '12px', border: '1px solid rgba(22,163,74,0.1)' }}>
            <CheckCircle2 size={20} style={{ color: '#16a34a', marginBottom: '8px' }} />
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#16a34a' }}>{formatCurrency(forecast.realizedRevenue)}</div>
            <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>Realized from {forecast.convertedCount} converted leads</div>
          </div>
          <div style={{ padding: '16px', background: 'rgba(37,99,235,0.05)', borderRadius: '12px', border: '1px solid rgba(37,99,235,0.1)' }}>
            <Clock size={20} style={{ color: '#2563eb', marginBottom: '8px' }} />
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#2563eb' }}>{formatCurrency(forecast.expectedRevenue - forecast.realizedRevenue)}</div>
            <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>Expected from active pipeline</div>
          </div>
          <div style={{ padding: '16px', background: 'rgba(124,58,237,0.05)', borderRadius: '12px', border: '1px solid rgba(124,58,237,0.1)' }}>
            <Zap size={20} style={{ color: '#7c3aed', marginBottom: '8px' }} />
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#7c3aed' }}>{formatCurrency(forecast.setupRevenue)}</div>
            <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>Setup cost revenue ({formatCurrency(setupCost)}/lead)</div>
          </div>
          <div style={{ padding: '16px', background: 'rgba(220,38,38,0.05)', borderRadius: '12px', border: '1px solid rgba(220,38,38,0.1)' }}>
            <AlertTriangle size={20} style={{ color: '#dc2626', marginBottom: '8px' }} />
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#dc2626' }}>{forecast.lostCount}</div>
            <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>Lost leads (not interested)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
