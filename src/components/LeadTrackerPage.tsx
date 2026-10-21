import React, { useMemo, useState } from 'react';
import { ArrowLeft, Users, TrendingUp, Percent, DollarSign, Calendar, Filter, Search, CheckCircle2, Clock, Star, MessageCircle } from 'lucide-react';
import { Session } from '@supabase/supabase-js';
import { SourceLogo, SOURCE_META, SOURCE_ORDER } from '@/components/BrandLogos';
import LeadSourceBadge from '@/components/LeadSourceBadge';
import LeadWhatsAppDrawer from '@/components/LeadWhatsAppDrawer';

type Lead = {
  id: string;
  full_name: string;
  email: string;
  mobile_number: string;
  status: string;
  created_at: string;
  lead_source?: string | null;
  fund_amount?: number | null;
  purchase_value?: number | null;
  state?: string | null;
};

type Props = {
  leads: Lead[];
  onBack: () => void;
  session: Session;
};

const STAGE_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  interested: 'Interested',
  negotiation: 'Negotiation',
  converted: 'Converted',
  not_interested: 'Not Interested',
};

const LeadTrackerPage: React.FC<Props> = ({ leads, onBack, session }) => {
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [chatLead, setChatLead] = useState<Lead | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  const openChat = (lead: Lead) => {
    setChatLead(lead);
    setChatOpen(true);
  };

  const sourceStats = useMemo(() => {
    const map: Record<string, { count: number; converted: number; interested: number; revenue: number; funds: number }> = {};
    for (const lead of leads) {
      const src = lead.lead_source || 'Landing Page';
      if (!map[src]) map[src] = { count: 0, converted: 0, interested: 0, revenue: 0, funds: 0 };
      map[src].count++;
      if (lead.status === 'converted') {
        map[src].converted++;
        map[src].revenue += lead.purchase_value || 0;
      }
      if (lead.status === 'interested') map[src].interested++;
      map[src].funds += lead.fund_amount || 0;
    }
    return map;
  }, [leads]);

  const allSources = useMemo(() => {
    const seen = new Set<string>();
    for (const lead of leads) seen.add(lead.lead_source || 'Landing Page');
    const ordered = SOURCE_ORDER.filter((s) => seen.has(s));
    const extra = [...seen].filter((s) => !ordered.includes(s));
    return [...ordered, ...extra];
  }, [leads]);

  const totalLeads = leads.length;
  const totalConverted = leads.filter((l) => l.status === 'converted').length;
  const totalRevenue = leads.filter((l) => l.status === 'converted').reduce((s, l) => s + (l.purchase_value || 0), 0);

  const filteredLeads = useMemo(() => {
    if (!selectedSource) return [];
    let result = leads.filter((l) => (l.lead_source || 'Landing Page') === selectedSource);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((l) =>
        l.full_name?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        l.mobile_number?.includes(q)
      );
    }
    if (statusFilter !== 'all') {
      result = result.filter((l) => l.status === statusFilter);
    }
    if (dateFilter !== 'all') {
      const now = new Date();
      let start = new Date(0);
      if (dateFilter === 'today') { start = new Date(); start.setHours(0, 0, 0, 0); }
      else if (dateFilter === 'last_7_days') { start = new Date(now.getTime() - 7 * 86400000); }
      else if (dateFilter === 'this_month') { start = new Date(now.getFullYear(), now.getMonth(), 1); }
      else if (dateFilter === 'this_year') { start = new Date(now.getFullYear(), 0, 1); }
      result = result.filter((l) => new Date(l.created_at) >= start);
    }
    return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [leads, selectedSource, search, statusFilter, dateFilter]);

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="dash-overview" style={{ minHeight: '100vh' }}>
      <div className="dash-page-header" style={{ marginBottom: 24 }}>
        <button className="dash-back-btn" onClick={onBack}><ArrowLeft size={18} /> Back</button>
        <h1>Lead Tracker</h1>
        <p>Track where every lead comes from and which channels drive the most conversions</p>
      </div>

      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
        <div style={{ background: 'var(--bg-card)', borderRadius: 14, padding: 20, border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={24} style={{ color: '#3B82F6' }} />
          </div>
          <div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)' }}>{totalLeads}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-dark)', fontWeight: 600 }}>Total Leads</div>
          </div>
        </div>
        <div style={{ background: 'var(--bg-card)', borderRadius: 14, padding: 20, border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(234,179,8,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={24} style={{ color: '#EAB308' }} />
          </div>
          <div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)' }}>{totalConverted}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-dark)', fontWeight: 600 }}>Conversions</div>
          </div>
        </div>
        <div style={{ background: 'var(--bg-card)', borderRadius: 14, padding: 20, border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Percent size={24} style={{ color: '#10B981' }} />
          </div>
          <div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {totalLeads > 0 ? ((totalConverted / totalLeads) * 100).toFixed(1) : '0'}%
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-dark)', fontWeight: 600 }}>Conversion Rate</div>
          </div>
        </div>
        <div style={{ background: 'var(--bg-card)', borderRadius: 14, padding: 20, border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DollarSign size={24} style={{ color: '#8B5CF6' }} />
          </div>
          <div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)' }}>
              ${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-dark)', fontWeight: 600 }}>Revenue from Conversions</div>
          </div>
        </div>
      </div>

      {/* Source Cards Grid */}
      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        <TrendingUp size={20} style={{ color: '#3B82F6' }} /> Lead Sources Breakdown
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 28 }}>
        {allSources.map((src) => {
          const stat = sourceStats[src] || { count: 0, converted: 0, interested: 0, revenue: 0, funds: 0 };
          const meta = SOURCE_META[src] || SOURCE_META['Unknown'];
          const pct = totalLeads > 0 ? (stat.count / totalLeads) * 100 : 0;
          const convRate = stat.count > 0 ? (stat.converted / stat.count) * 100 : 0;
          return (
            <div
              key={src}
              onClick={() => setSelectedSource(selectedSource === src ? null : src)}
              style={{
                background: 'var(--bg-card)',
                borderRadius: 14,
                padding: 20,
                border: selectedSource === src ? `2px solid ${meta.color}` : '1px solid var(--border-subtle)',
                cursor: 'pointer',
                transition: 'all 0.15s',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => { if (selectedSource !== src) e.currentTarget.style.borderColor = meta.color + '60'; }}
              onMouseLeave={(e) => { if (selectedSource !== src) e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: meta.color }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: meta.bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <SourceLogo source={src} size={26} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta.label}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dark)', fontWeight: 600 }}>{pct.toFixed(1)}% of all leads</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: meta.color }}>{stat.count}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', fontWeight: 600, color: '#16a34a', background: 'rgba(22,163,74,0.08)', padding: '4px 8px', borderRadius: 6 }}>
                  <CheckCircle2 size={12} /> {stat.converted} converted
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', fontWeight: 600, color: '#f59e0b', background: 'rgba(245,158,11,0.08)', padding: '4px 8px', borderRadius: 6 }}>
                  <Star size={12} /> {stat.interested} interested
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-dark)', background: 'rgba(100,116,139,0.08)', padding: '4px 8px', borderRadius: 6 }}>
                  <Percent size={12} /> {convRate.toFixed(0)}% conv
                </span>
              </div>
              <div style={{ marginTop: 12, height: 6, borderRadius: 3, background: 'var(--bg-light)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: meta.color, borderRadius: 3, transition: 'width 0.3s' }} />
              </div>
              {stat.revenue > 0 && (
                <div style={{ marginTop: 10, fontSize: '0.75rem', fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <DollarSign size={13} /> {stat.revenue.toLocaleString('en-US')} revenue
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Source Detail Table */}
      {selectedSource && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: (SOURCE_META[selectedSource] || SOURCE_META['Unknown']).bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <SourceLogo source={selectedSource} size={22} />
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              {(SOURCE_META[selectedSource] || SOURCE_META['Unknown']).label} — {filteredLeads.length} leads
            </h3>
            <div style={{ flex: 1 }} />
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dark)' }} />
              <input
                type="text"
                placeholder="Search leads..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: 34, paddingRight: 12, padding: '8px 12px 8px 34px', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: '0.82rem', width: 200, outline: 'none' }}
              />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '8px 12px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer', outline: 'none' }}>
              <option value="all">All Statuses</option>
              {Object.entries(STAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '8px 12px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer', outline: 'none' }}>
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="last_7_days">Last 7 Days</option>
              <option value="this_month">This Month</option>
              <option value="this_year">This Year</option>
            </select>
            <button onClick={() => { setSearch(''); setStatusFilter('all'); setDateFilter('all'); }} style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '8px 12px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-dark)', cursor: 'pointer', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Filter size={14} /> Clear
            </button>
          </div>
          <div style={{ maxHeight: 500, overflowY: 'auto' }}>
            {filteredLeads.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-dark)' }}>
                <Users size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
                <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>No leads found from this source</p>
              </div>
            ) : (
              <table className="crm-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th className="crm-th" style={{ padding: '10px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dark)', textAlign: 'left' }}>Lead</th>
                    <th className="crm-th" style={{ padding: '10px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dark)', textAlign: 'left' }}>Status</th>
                    <th className="crm-th" style={{ padding: '10px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dark)', textAlign: 'left' }}>Source</th>
                    <th className="crm-th" style={{ padding: '10px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dark)', textAlign: 'left' }}>Fund</th>
                    <th className="crm-th" style={{ padding: '10px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dark)', textAlign: 'left' }}>Date</th>
                    <th className="crm-th" style={{ padding: '10px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dark)', textAlign: 'right' }}>Chat</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-dark)', flexShrink: 0 }}>
                            {lead.full_name?.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() || '?'}
                          </div>
                          <div>
                            <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)' }}>{lead.full_name}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-dark)' }}>{lead.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        {STAGE_LABELS[lead.status] || lead.status}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <LeadSourceBadge source={lead.lead_source} size={16} />
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 700, color: lead.fund_amount ? '#16a34a' : 'var(--text-dark)' }}>
                        {lead.fund_amount != null ? `$${lead.fund_amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '0.75rem', color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Calendar size={12} /> {formatDate(lead.created_at)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          className="lead-wa-row-btn"
                          onClick={(e) => { e.stopPropagation(); openChat(lead); }}
                          disabled={!lead.mobile_number}
                          title={lead.mobile_number ? 'Open WhatsApp chat' : 'No phone number'}
                          aria-label="Open WhatsApp chat"
                        >
                          <MessageCircle size={16} />
                          <span className="lead-wa-row-btn-label">Chat</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      <LeadWhatsAppDrawer
        open={chatOpen}
        lead={chatLead}
        session={session}
        onClose={() => setChatOpen(false)}
      />
    </div>
  );
};

export default LeadTrackerPage;
