import { useMemo, useState } from 'react';
import { ArrowLeft, Copy, Merge, Check, Users, AlertTriangle } from 'lucide-react';

interface Lead {
  id: string;
  full_name: string;
  email: string;
  mobile_number: string;
  state: string;
  status: string;
  fund_amount: number | null;
  notes: string;
  tags: string[];
  created_at: string;
  assigned_to?: string | null;
}

interface DuplicateDetectionViewProps {
  leads: Lead[];
  onBack: () => void;
  onMerge: (keepLead: Lead, removeLead: Lead) => Promise<boolean>;
  assigneeMap?: Record<string, string>;
}

function scoreLead(l: Lead): number {
  let score = 0;
  if (l.email) score += 2;
  if (l.mobile_number) score += 2;
  if (l.state && l.state !== 'N/A') score += 1;
  if (l.fund_amount) score += 3;
  if (l.notes) score += 1;
  if (l.tags && l.tags.length > 0) score += 1;
  if (l.status !== 'new') score += 2;
  return score;
}

export default function DuplicateDetectionView({ leads, onBack, onMerge, assigneeMap }: DuplicateDetectionViewProps) {
  const [merging, setMerging] = useState(false);
  const [mergeResult, setMergeResult] = useState<string | null>(null);

  const duplicateGroups = useMemo(() => {
    const seen = new Map<string, Lead[]>();
    const normPhone = (s: string) => s.replace(/[\s+\-()]/g, '').toLowerCase();
    const normEmail = (s: string) => s.trim().toLowerCase();
    for (const l of leads) {
      const e = normEmail(l.email);
      const p = normPhone(l.mobile_number);
      const key = e || p;
      if (!key) continue;
      if (seen.has(key)) {
        seen.get(key)!.push(l);
      } else {
        seen.set(key, [l]);
      }
    }
    return Array.from(seen.values())
      .filter((group) => group.length > 1)
      .map((group) => group.sort((a, b) => scoreLead(b) - scoreLead(a)));
  }, [leads]);

  const totalDupes = duplicateGroups.reduce((sum, g) => g.length, 0);

  const handleMerge = async (keep: Lead, remove: Lead) => {
    setMerging(true);
    setMergeResult(null);
    const success = await onMerge(keep, remove);
    setMerging(false);
    setMergeResult(success ? `Merged "${remove.full_name}" into "${keep.full_name}"` : 'Merge failed');
    setTimeout(() => setMergeResult(null), 3000);
  };

  const statusColors: Record<string, string> = {
    new: '#3B82F6',
    interested: '#22C55E',
    converted: '#EAB308',
    not_interested: '#EF4444',
    called_no_response: '#F97316',
    called_responded: '#06B6D4',
  };

  return (
    <div className="dash-overview">
      <div className="dash-page-header">
        <button className="dash-back-btn" onClick={onBack}><ArrowLeft size={18} /> Back</button>
        <h1>Duplicate Detection</h1>
        <p>Find and merge duplicate leads by email or phone</p>
      </div>

      <div className="dash-dupe-summary">
        <div className="dash-dupe-summary-card">
          <div className="dash-dupe-summary-icon"><Copy size={20} /></div>
          <div>
            <span className="dash-dupe-summary-val">{duplicateGroups.length}</span>
            <span className="dash-dupe-summary-label">Duplicate Groups</span>
          </div>
        </div>
        <div className="dash-dupe-summary-card">
          <div className="dash-dupe-summary-icon"><Users size={20} /></div>
          <div>
            <span className="dash-dupe-summary-val">{totalDupes}</span>
            <span className="dash-dupe-summary-label">Total Duplicate Leads</span>
          </div>
        </div>
      </div>

      {mergeResult && (
        <div className="dash-dupe-toast">{mergeResult}</div>
      )}

      {duplicateGroups.length === 0 ? (
        <div className="dash-card">
          <div className="dash-recent-empty">
            <Check size={40} />
            <p>No duplicates found — your leads are clean!</p>
          </div>
        </div>
      ) : (
        <div className="dash-dupe-groups">
          {duplicateGroups.map((group, gi) => (
            <div key={gi} className="dash-card">
              <div className="dash-card-header">
                <div className="dash-card-title">
                  <div className="dash-card-icon dash-card-icon-red"><AlertTriangle size={18} /></div>
                  <h2>Group {gi + 1}</h2>
                  <span className="dash-pipeline-total-badge">{group.length} leads</span>
                </div>
              </div>
              <div className="dash-dupe-group-list">
                {group.map((lead, li) => (
                  <div key={lead.id} className="dash-dupe-lead-row">
                    <div className="dash-dupe-lead-rank">
                      {li === 0 ? (
                        <span className="dash-dupe-keeper-badge">KEEP</span>
                      ) : (
                        <button
                          className="dash-dupe-merge-btn"
                          onClick={() => handleMerge(group[0], lead)}
                          disabled={merging}
                        >
                          <Merge size={14} /> Merge into keeper
                        </button>
                      )}
                    </div>
                    <div className="dash-dupe-lead-info">
                      <div className="dash-dupe-lead-name">{lead.full_name}</div>
                      <div className="dash-dupe-lead-meta">
                        {lead.email && <span>{lead.email}</span>}
                        {lead.mobile_number && <span>{lead.mobile_number}</span>}
                      </div>
                      <div className="dash-dupe-lead-tags">
                        <span className="dash-dupe-lead-status" style={{ color: statusColors[lead.status] || '#94A3B8' }}>
                          {lead.status.replace(/_/g, ' ')}
                        </span>
                        {lead.fund_amount != null && <span className="dash-dupe-lead-fund">${lead.fund_amount.toLocaleString()}</span>}
                        {lead.assigned_to && assigneeMap?.[lead.assigned_to] && (
                          <span className="dash-dupe-lead-assignee">{assigneeMap[lead.assigned_to]}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
