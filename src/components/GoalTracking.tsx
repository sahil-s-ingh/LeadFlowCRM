import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Target, TrendingUp, DollarSign, Users, Edit2, Check, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

interface Lead {
  id: string;
  status: string;
  fund_amount: number | null;
  created_at: string;
}

interface GoalTrackingProps {
  session: Session;
  leads: Lead[];
  onBack: () => void;
}

interface Goal {
  id: string;
  goal_type: 'revenue' | 'conversions' | 'leads';
  target_value: number;
  period_month: number;
  period_year: number;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function GoalTracking({ session, leads, onBack }: GoalTrackingProps) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('sales_goals')
        .select('id, goal_type, target_value, period_month, period_year')
        .eq('user_id', session.user.id)
        .eq('period_month', currentMonth)
        .eq('period_year', currentYear);
      setGoals((data || []) as Goal[]);
      setLoading(false);
    })();
  }, [session.user.id, currentMonth, currentYear]);

  const actuals = useMemo(() => {
    const monthStart = new Date(currentYear, currentMonth - 1, 1);
    const monthLeads = leads.filter((l) => new Date(l.created_at) >= monthStart);
    return {
      leads: monthLeads.length,
      conversions: monthLeads.filter((l) => l.status === 'converted').length,
      revenue: monthLeads.filter((l) => l.status === 'converted').reduce((s, l) => s + (l.fund_amount || 0), 0),
    };
  }, [leads, currentMonth, currentYear]);

  const getGoal = (type: Goal['goal_type']) => goals.find((g) => g.goal_type === type);

  const saveGoal = async (type: Goal['goal_type']) => {
    const value = parseFloat(editValue) || 0;
    const existing = getGoal(type);
    if (existing) {
      const { data } = await supabase
        .from('sales_goals')
        .update({ target_value: value, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select('id, goal_type, target_value, period_month, period_year')
        .maybeSingle();
      if (data) {
        setGoals((prev) => prev.map((g) => (g.id === existing.id ? data as Goal : g)));
      }
    } else {
      const { data } = await supabase
        .from('sales_goals')
        .insert({
          user_id: session.user.id,
          goal_type: type,
          target_value: value,
          period_month: currentMonth,
          period_year: currentYear,
        })
        .select('id, goal_type, target_value, period_month, period_year')
        .maybeSingle();
      if (data) {
        setGoals((prev) => [...prev, data as Goal]);
      }
    }
    setEditing(null);
    setEditValue('');
  };

  const startEdit = (type: Goal['goal_type']) => {
    setEditing(type);
    const g = getGoal(type);
    setEditValue(g ? String(g.target_value) : '');
  };

  const goalCards: {
    type: Goal['goal_type'];
    label: string;
    icon: typeof Target;
    color: string;
    bg: string;
    actual: number;
    format: (n: number) => string;
  }[] = [
    { type: 'revenue', label: 'Revenue Target', icon: DollarSign, color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)', actual: actuals.revenue, format: (n) => '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 }) },
    { type: 'conversions', label: 'Conversions Target', icon: Target, color: '#EAB308', bg: 'rgba(234,179,8,0.1)', actual: actuals.conversions, format: (n) => String(n) },
    { type: 'leads', label: 'New Leads Target', icon: Users, color: '#3B82F6', bg: 'rgba(59,130,246,0.1)', actual: actuals.leads, format: (n) => String(n) },
  ];

  return (
    <div className="dash-overview">
      <div className="dash-page-header">
        <button className="dash-back-btn" onClick={onBack}><ArrowLeft size={18} /> Back</button>
        <h1>Goal Tracking</h1>
        <p>{MONTH_NAMES[currentMonth - 1]} {currentYear} — Set targets and track progress</p>
      </div>

      {loading ? (
        <div className="dash-overview-loading">
          <div className="dash-loading-spinner" />
          <p>Loading goals...</p>
        </div>
      ) : (
        <div className="dash-goals-grid">
          {goalCards.map((card) => {
            const goal = getGoal(card.type);
            const target = goal?.target_value || 0;
            const pct = target > 0 ? Math.min(100, Math.round((card.actual / target) * 100)) : 0;
            const Icon = card.icon;
            const isEditing = editing === card.type;
            return (
              <div key={card.type} className="dash-goal-card">
                <div className="dash-goal-header">
                  <div className="dash-goal-icon" style={{ background: card.bg, color: card.color }}>
                    <Icon size={22} />
                  </div>
                  <div className="dash-goal-header-info">
                    <span className="dash-goal-label">{card.label}</span>
                    <span className="dash-goal-period">{MONTH_NAMES[currentMonth - 1]} {currentYear}</span>
                  </div>
                  {!isEditing && (
                    <button className="dash-goal-edit-btn" onClick={() => startEdit(card.type)}>
                      <Edit2 size={14} />
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <div className="dash-goal-edit-row">
                    <input
                      type="number"
                      className="dash-goal-input"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      placeholder="Set target..."
                      autoFocus
                    />
                    <button className="dash-goal-save-btn" onClick={() => saveGoal(card.type)}><Check size={16} /></button>
                    <button className="dash-goal-cancel-btn" onClick={() => { setEditing(null); setEditValue(''); }}><X size={16} /></button>
                  </div>
                ) : (
                  <>
                    <div className="dash-goal-values">
                      <div className="dash-goal-actual" style={{ color: card.color }}>
                        {card.format(card.actual)}
                      </div>
                      <div className="dash-goal-target">
                        of {card.format(target)}
                      </div>
                    </div>
                    <div className="dash-goal-progress-track">
                      <div
                        className="dash-goal-progress-fill"
                        style={{ width: `${pct}%`, background: card.color }}
                      />
                    </div>
                    <div className="dash-goal-pct-row">
                      <span className="dash-goal-pct" style={{ color: pct >= 100 ? '#22C55E' : card.color }}>
                        {pct}% {pct >= 100 ? '— Goal reached!' : ''}
                      </span>
                      {target > 0 && (
                        <span className="dash-goal-remaining">
                          {pct >= 100 ? '' : `${card.format(Math.max(0, target - card.actual))} to go`}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
