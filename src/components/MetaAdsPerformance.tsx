import { useState, useEffect, useCallback } from 'react';
import { BarChart3, TrendingUp, DollarSign, Eye, MousePointerClick, Target, Loader2 } from 'lucide-react';

interface MetaAdsPerformanceProps {
  callApi: (action: string, extra?: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

interface TimeSeriesPoint {
  date_start: string;
  spend: string;
  impressions: string;
  clicks: string;
  reach: string;
  ctr: string;
  cpc: string;
  cpm: string;
}

export default function MetaAdsPerformance({ callApi }: MetaAdsPerformanceProps) {
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dateRange, setDateRange] = useState('last_7d');
  const [campaignId, setCampaignId] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await callApi('get_performance_time_series', {
        campaign_id: campaignId || undefined,
        date_range: dateRange,
      });
      setTimeSeries((result.time_series as TimeSeriesPoint[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch performance data');
    }
    setLoading(false);
  }, [callApi, campaignId, dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalSpend = timeSeries.reduce((sum, d) => sum + parseFloat(d.spend || '0'), 0);
  const totalImpressions = timeSeries.reduce((sum, d) => sum + parseInt(d.impressions || '0', 10), 0);
  const totalClicks = timeSeries.reduce((sum, d) => sum + parseInt(d.clicks || '0', 10), 0);
  const totalReach = timeSeries.reduce((sum, d) => sum + parseInt(d.reach || '0', 10), 0);
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
  const avgCpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;

  const maxSpend = Math.max(...timeSeries.map((d) => parseFloat(d.spend || '0')), 1);
  const maxClicks = Math.max(...timeSeries.map((d) => parseInt(d.clicks || '0', 10)), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>Performance Dashboard</h3>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            placeholder="Campaign ID (optional)"
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.8rem', width: '200px' }}
          />
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.8rem', cursor: 'pointer' }}>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last_3d">Last 3 days</option>
            <option value="last_7d">Last 7 days</option>
            <option value="last_14d">Last 14 days</option>
            <option value="last_30d">Last 30 days</option>
            <option value="this_month">This month</option>
            <option value="last_month">Last month</option>
            <option value="maximum">All time</option>
          </select>
          <button onClick={fetchData} disabled={loading} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            {loading ? <Loader2 size={15} className="crm-spin" /> : <BarChart3 size={15} />} Refresh
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '12px 16px', color: '#dc2626', fontSize: '0.85rem', fontWeight: 600 }}>
          {error}
        </div>
      )}

      {/* Summary stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px' }}>
        <PerfStatCard icon={<DollarSign size={18} />} label="Total Spend" value={`$${totalSpend.toFixed(2)}`} color="#1877F2" />
        <PerfStatCard icon={<Eye size={18} />} label="Impressions" value={totalImpressions.toLocaleString()} color="#8B5CF6" />
        <PerfStatCard icon={<MousePointerClick size={18} />} label="Clicks" value={totalClicks.toLocaleString()} color="#F59E0B" />
        <PerfStatCard icon={<Target size={18} />} label="Reach" value={totalReach.toLocaleString()} color="#16A34A" />
        <PerfStatCard icon={<TrendingUp size={18} />} label="CTR" value={`${avgCtr.toFixed(2)}%`} color="#0d9488" />
        <PerfStatCard icon={<DollarSign size={18} />} label="CPC" value={`$${avgCpc.toFixed(2)}`} color="#eab308" />
        <PerfStatCard icon={<DollarSign size={18} />} label="CPM" value={`$${avgCpm.toFixed(2)}`} color="#6366f1" />
      </div>

      {/* Spend over time chart */}
      {timeSeries.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <ChartCard title="Daily Spend" color="#1877F2">
            <BarChart data={timeSeries.map((d) => ({ label: d.date_start.slice(5), value: parseFloat(d.spend || '0'), max: maxSpend }))} color="#1877F2" format={(v) => `$${v.toFixed(2)}`} />
          </ChartCard>
          <ChartCard title="Daily Clicks" color="#F59E0B">
            <BarChart data={timeSeries.map((d) => ({ label: d.date_start.slice(5), value: parseInt(d.clicks || '0', 10), max: maxClicks }))} color="#F59E0B" format={(v) => v.toLocaleString()} />
          </ChartCard>
        </div>
      )}

      {/* Detailed table */}
      {timeSeries.length > 0 && (
        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
            <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>Daily Breakdown</h4>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-light)' }}>
                  <th style={th}>Date</th>
                  <th style={th}>Spend</th>
                  <th style={th}>Impressions</th>
                  <th style={th}>Clicks</th>
                  <th style={th}>Reach</th>
                  <th style={th}>CTR</th>
                  <th style={th}>CPC</th>
                  <th style={th}>CPM</th>
                </tr>
              </thead>
              <tbody>
                {timeSeries.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={td}>{row.date_start}</td>
                    <td style={td}>${parseFloat(row.spend || '0').toFixed(2)}</td>
                    <td style={td}>{parseInt(row.impressions || '0', 10).toLocaleString()}</td>
                    <td style={td}>{parseInt(row.clicks || '0', 10).toLocaleString()}</td>
                    <td style={td}>{parseInt(row.reach || '0', 10).toLocaleString()}</td>
                    <td style={td}>{parseFloat(row.ctr || '0').toFixed(2)}%</td>
                    <td style={td}>${parseFloat(row.cpc || '0').toFixed(2)}</td>
                    <td style={td}>${parseFloat(row.cpm || '0').toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {timeSeries.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
          <BarChart3 size={40} style={{ color: 'var(--text-dark)', margin: '0 auto 12px' }} />
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>No performance data available for this date range.</p>
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontWeight: 700, fontSize: '0.76rem', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.04em' };
const td: React.CSSProperties = { padding: '10px 14px', fontSize: '0.82rem', color: 'var(--text-main)', fontWeight: 500 };

function PerfStatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)', padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>{icon}</div>
        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-dark)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      </div>
      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-main)' }}>{value}</div>
    </div>
  );
}

function ChartCard({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)', padding: '20px' }}>
      <h4 style={{ margin: '0 0 16px', fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, display: 'inline-block' }} /> {title}
      </h4>
      {children}
    </div>
  );
}

function BarChart({ data, color, format }: { data: Array<{ label: string; value: number; max: number }>; color: string; format: (v: number) => string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '160px', padding: '0 4px' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }}>
          <div title={format(d.value)} style={{ width: '100%', maxWidth: '40px', height: `${(d.value / d.max) * 100}%`, minHeight: d.value > 0 ? '4px' : '0', background: color, borderRadius: '4px 4px 0 0', transition: 'height 0.3s ease', cursor: 'pointer' }} />
          <span style={{ fontSize: '0.6rem', color: 'var(--text-dark)', whiteSpace: 'nowrap' }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}
