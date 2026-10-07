import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Users, Shuffle, Loader2, CheckCircle2, AlertTriangle, Search,
  UserPlus, ArrowRight, Filter,
} from 'lucide-react';

type Lead = {
  id: string;
  full_name: string;
  email: string;
  mobile_number: string;
  state: string;
  trading_product: 'algo' | 'tradingview_premium' | 'both';
  status: string;
  created_at: string;
  assigned_to: string | null;
};

type TeamMember = {
  id: string;
  email: string;
  role: 'admin' | 'manager' | 'agent';
  full_name: string | null;
  status: 'pending' | 'active' | 'disabled';
};

type Props = {
  session: { user: { id: string } };
};

const STATUS_COLORS: Record<string, string> = {
  new: '#3B82F6',
  called_no_response: '#F59E0B',
  called_responded: '#F59E0B',
  interested: '#8B5CF6',
  not_interested: '#EF4444',
  converted: '#16A34A',
};

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  called_no_response: 'Called — No Response',
  called_responded: 'Called — Responded',
  interested: 'Interested',
  not_interested: 'Not Interested',
  converted: 'Converted',
};

const PRODUCT_LABELS: Record<string, string> = {
  algo: 'Trading Algo',
  tradingview_premium: 'TradingView Premium',
  both: 'Both',
};

type SortMode = 'round_robin' | 'workload';

export default function LeadDistributionPanel({ session }: Props) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterProduct, setFilterProduct] = useState('all');
  const [filterAssignment, setFilterAssignment] = useState<'unassigned' | 'all'>('unassigned');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAssignee, setBulkAssignee] = useState('');
  const [distributing, setDistributing] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [resultMsg, setResultMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const activeMembers = useMemo(() => members.filter((m) => m.status === 'active'), [members]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [leadsRes, membersRes] = await Promise.all([
      supabase.from('submissions').select('id, full_name, email, mobile_number, state, trading_product, status, created_at, assigned_to, deleted_at').is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('team_members').select('id, email, role, full_name, status, owner_id').eq('owner_id', session.user.id).order('created_at', { ascending: true }),
    ]);
    if (leadsRes.data) setLeads(leadsRes.data as Lead[]);
    if (membersRes.data) setMembers(membersRes.data as TeamMember[]);
    setLoading(false);
  }, [session.user.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Realtime updates
  useEffect(() => {
    const channel = supabase.channel('lead-distribution-panel');
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, () => { fetchAll(); });
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'team_members' }, () => { fetchAll(); });
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  const memberName = (id: string | null) => {
    if (!id) return 'Unassigned';
    const m = members.find((x) => x.id === id);
    return m ? (m.full_name || m.email) : 'Unknown';
  };

  // Lead counts per member
  const leadCounts = useMemo(() => {
    const counts = new Map<string, number>();
    leads.forEach((l) => {
      if (l.assigned_to) counts.set(l.assigned_to, (counts.get(l.assigned_to) || 0) + 1);
    });
    return counts;
  }, [leads]);

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      if (filterAssignment === 'unassigned' && l.assigned_to) return false;
      if (filterStatus !== 'all' && l.status !== filterStatus) return false;
      if (filterProduct !== 'all' && l.trading_product !== filterProduct) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!l.full_name.toLowerCase().includes(q) && !l.email.toLowerCase().includes(q) && !l.mobile_number.includes(q)) return false;
      }
      return true;
    });
  }, [leads, filterAssignment, filterStatus, filterProduct, search]);

  const unassignedCount = leads.filter((l) => !l.assigned_to).length;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds(new Set(filteredLeads.map((l) => l.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  // Assign one lead to a member
  const assignOne = async (leadId: string, memberId: string) => {
    setAssigning(true);
    setResultMsg(null);
    const { error } = await supabase.from('submissions').update({ assigned_to: memberId || null }).eq('id', leadId);
    setAssigning(false);
    if (error) {
      setResultMsg({ type: 'error', text: error.message });
      return;
    }
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, assigned_to: memberId || null } : l)));
    setSelectedIds((prev) => { const n = new Set(prev); n.delete(leadId); return n; });
  };

  // Bulk assign selected to one member
  const bulkAssign = async () => {
    if (!bulkAssignee || selectedIds.size === 0) return;
    setDistributing(true);
    setResultMsg(null);
    const ids = Array.from(selectedIds);
    const BATCH = 100;
    let err: string | null = null;
    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = ids.slice(i, i + BATCH);
      const { error } = await supabase.from('submissions').update({ assigned_to: bulkAssignee }).in('id', batch);
      if (error) { err = error.message; break; }
    }
    setDistributing(false);
    if (err) {
      setResultMsg({ type: 'error', text: err });
      return;
    }
    setLeads((prev) => prev.map((l) => (selectedIds.has(l.id) ? { ...l, assigned_to: bulkAssignee } : l)));
    setResultMsg({ type: 'success', text: `${ids.length} lead${ids.length !== 1 ? 's' : ''} assigned to ${memberName(bulkAssignee)}.` });
    clearSelection();
    setBulkAssignee('');
  };

  // Auto-distribute selected across active members
  const autoDistribute = async (mode: SortMode) => {
    if (selectedIds.size === 0 || activeMembers.length === 0) return;
    setDistributing(true);
    setResultMsg(null);
    const ids = Array.from(selectedIds);

    // Build assignment plan
    const plan: Record<string, string> = {};
    if (mode === 'round_robin') {
      ids.forEach((id, idx) => { plan[id] = activeMembers[idx % activeMembers.length].id; });
    } else {
      // workload — fewest leads first
      const counts = new Map<string, number>();
      activeMembers.forEach((m) => counts.set(m.id, leadCounts.get(m.id) || 0));
      ids.forEach((id) => {
        let minId = activeMembers[0].id;
        let minCount = Infinity;
        activeMembers.forEach((m) => {
          const c = counts.get(m.id) || 0;
          if (c < minCount) { minCount = c; minId = m.id; }
        });
        plan[id] = minId;
        counts.set(minId, (counts.get(minId) || 0) + 1);
      });
    }

    // Execute in batches per member
    const byMember = new Map<string, string[]>();
    Object.entries(plan).forEach(([leadId, memberId]) => {
      if (!byMember.has(memberId)) byMember.set(memberId, []);
      byMember.get(memberId)!.push(leadId);
    });

    let err: string | null = null;
    for (const [memberId, leadIds] of byMember) {
      for (let i = 0; i < leadIds.length; i += BATCH_SIZE) {
        const batch = leadIds.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('submissions').update({ assigned_to: memberId }).in('id', batch);
        if (error) { err = error.message; break; }
      }
      if (err) break;
    }
    setDistributing(false);
    if (err) {
      setResultMsg({ type: 'error', text: err });
      return;
    }
    setLeads((prev) => prev.map((l) => (plan[l.id] ? { ...l, assigned_to: plan[l.id] } : l)));
    setResultMsg({ type: 'success', text: `${ids.length} lead${ids.length !== 1 ? 's' : ''} distributed across ${byMember.size} team member${byMember.size !== 1 ? 's' : ''}.` });
    clearSelection();
  };

  const BATCH_SIZE = 100;

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
        <Loader2 size={28} className="crm-spin" style={{ color: '#0f766e' }} />
      </div>
    );
  }

  return (
    <>
      <div className="crm-settings-card-header">
        <h2 className="crm-settings-card-title"><Shuffle size={20} style={{ color: '#0f766e' }} /> Lead Distribution</h2>
        <p className="crm-settings-card-desc">Distribute leads across your team — one at a time or in bulk. See each agent's current workload and auto-balance assignments in seconds.</p>
      </div>

      {resultMsg && (
        <div
          style={{
            background: resultMsg.type === 'success' ? 'rgba(22,163,74,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${resultMsg.type === 'success' ? 'rgba(22,163,74,0.3)' : 'rgba(239,68,68,0.3)'}`,
            borderRadius: '8px', padding: '10px 14px',
            color: resultMsg.type === 'success' ? '#16a34a' : '#dc2626',
            fontSize: '0.82rem', fontWeight: 600, marginBottom: '12px',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}
        >
          {resultMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {resultMsg.text}
        </div>
      )}

      {/* Agent workload cards */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '10px' }}>
          Team Workload
        </div>
        {activeMembers.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #e2e8f0', color: '#94a3b8', fontSize: '0.82rem' }}>
            <Users size={28} style={{ marginBottom: '6px', opacity: 0.3 }} />
            <p>No active team members. Invite agents from the Team tab first.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
            {activeMembers.map((m) => {
              const count = leadCounts.get(m.id) || 0;
              const maxCount = Math.max(...Array.from(leadCounts.values()), 1);
              const pct = Math.round((count / maxCount) * 100);
              return (
                <div key={m.id} style={{ padding: '14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #0f766e, #14b8a6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>
                      {(m.full_name || m.email)[0]?.toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <strong style={{ fontSize: '0.82rem', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.full_name || m.email}</strong>
                      <span style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'capitalize' }}>{m.role}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f766e' }}>{count}</span>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>leads</span>
                  </div>
                  <div style={{ height: '5px', borderRadius: '3px', background: '#e2e8f0', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #0f766e, #14b8a6)', borderRadius: '3px', transition: 'width 0.3s' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Filters bar */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or phone..."
            style={{ width: '100%', padding: '9px 12px 9px 34px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.83rem', outline: 'none' }}
          />
        </div>
        <select value={filterAssignment} onChange={(e) => setFilterAssignment(e.target.value as 'unassigned' | 'all')} style={{ padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.83rem', cursor: 'pointer', background: '#fff' }}>
          <option value="unassigned">Unassigned only</option>
          <option value="all">All leads</option>
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.83rem', cursor: 'pointer', background: '#fff' }}>
          <option value="all">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)} style={{ padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.83rem', cursor: 'pointer', background: '#fff' }}>
          <option value="all">All products</option>
          {Object.entries(PRODUCT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', padding: '12px 16px', background: 'rgba(15,118,110,0.06)', border: '1px solid rgba(15,118,110,0.2)', borderRadius: '10px', marginBottom: '14px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f766e' }}>{selectedIds.size} selected</span>
          <button onClick={clearSelection} style={{ fontSize: '0.75rem', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Clear</button>
          <div style={{ width: '1px', height: '24px', background: '#e2e8f0' }} />
          <select value={bulkAssignee} onChange={(e) => setBulkAssignee(e.target.value)} style={{ padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.82rem', cursor: 'pointer', background: '#fff' }}>
            <option value="">Assign to...</option>
            {activeMembers.map((m) => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
          </select>
          <button
            onClick={bulkAssign}
            disabled={!bulkAssignee || distributing}
            style={{ padding: '8px 16px', border: 'none', borderRadius: '8px', background: (!bulkAssignee || distributing) ? '#cbd5e1' : '#0f766e', color: '#fff', fontSize: '0.82rem', fontWeight: 600, cursor: (!bulkAssignee || distributing) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {distributing ? <Loader2 size={15} className="crm-spin" /> : <UserPlus size={15} />}
            Assign
          </button>
          <div style={{ width: '1px', height: '24px', background: '#e2e8f0' }} />
          <button
            onClick={() => autoDistribute('round_robin')}
            disabled={distributing || activeMembers.length === 0}
            style={{ padding: '8px 16px', border: '1px solid rgba(15,118,110,0.3)', borderRadius: '8px', background: '#fff', color: '#0f766e', fontSize: '0.82rem', fontWeight: 600, cursor: distributing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Shuffle size={15} /> Round Robin
          </button>
          <button
            onClick={() => autoDistribute('workload')}
            disabled={distributing || activeMembers.length === 0}
            style={{ padding: '8px 16px', border: '1px solid rgba(15,118,110,0.3)', borderRadius: '8px', background: '#fff', color: '#0f766e', fontSize: '0.82rem', fontWeight: 600, cursor: distributing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Filter size={15} /> Fewest Leads
          </button>
        </div>
      )}

      {/* Lead list */}
      <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>
            {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''}
            {filterAssignment === 'unassigned' && ` · ${unassignedCount} unassigned total`}
          </span>
          {filteredLeads.length > 0 && (
            <button onClick={selectedIds.size === filteredLeads.length ? clearSelection : selectAllFiltered} style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0f766e', background: 'none', border: 'none', cursor: 'pointer' }}>
              {selectedIds.size === filteredLeads.length ? 'Deselect all' : 'Select all'}
            </button>
          )}
        </div>

        {filteredLeads.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: '0.85rem' }}>
            <Users size={32} style={{ marginBottom: '8px', opacity: 0.3 }} />
            <p>{search || filterStatus !== 'all' || filterProduct !== 'all' ? 'No leads match your filters.' : 'No leads to distribute.'}</p>
          </div>
        ) : (
          <div style={{ maxHeight: '440px', overflowY: 'auto' }}>
            {filteredLeads.map((lead) => {
              const isSelected = selectedIds.has(lead.id);
              return (
                <div
                  key={lead.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
                    borderBottom: '1px solid #f1f5f9', background: isSelected ? 'rgba(15,118,110,0.04)' : '#fff',
                    transition: 'background 0.15s',
                  }}
                >
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(lead.id)} style={{ width: '16px', height: '16px', accentColor: '#0f766e' }} />
                  </label>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.full_name}</strong>
                      <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', whiteSpace: 'nowrap', background: `${STATUS_COLORS[lead.status] || '#64748b'}20`, color: STATUS_COLORS[lead.status] || '#64748b' }}>
                        {STATUS_LABELS[lead.status] || lead.status}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.email}</span>
                      <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>· {PRODUCT_LABELS[lead.trading_product] || lead.trading_product}</span>
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {lead.assigned_to && (
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {memberName(lead.assigned_to)}
                      </span>
                    )}
                    <select
                      value={lead.assigned_to || ''}
                      onChange={(e) => assignOne(lead.id, e.target.value)}
                      disabled={assigning}
                      style={{
                        padding: '5px 10px', border: '1px solid #e2e8f0', borderRadius: '6px',
                        fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', background: '#fff',
                        color: lead.assigned_to ? '#0f766e' : '#94a3b8',
                        outline: 'none',
                      }}
                    >
                      <option value="">{lead.assigned_to ? 'Unassign' : 'Assign to...'}</option>
                      {activeMembers.map((m) => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
                    </select>
                    <ArrowRight size={14} style={{ color: '#cbd5e1' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
