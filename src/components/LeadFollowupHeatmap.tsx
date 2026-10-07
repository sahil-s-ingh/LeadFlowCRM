import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, CircleHelp, Mail, MessageCircle, Phone, RefreshCw, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type ActivityKind = 'followup' | 'call' | 'message' | 'email' | 'lead';

type ActivityRecord = {
  id: string;
  date: string;
  kind: ActivityKind;
};

type DayCell = {
  date: Date;
  key: string;
  day: number;
  inMonth: boolean;
  activities: ActivityRecord[];
};

const activityLabels: Record<ActivityKind, string> = {
  followup: 'Follow-ups',
  call: 'Calls',
  message: 'Messages',
  email: 'Emails',
  lead: 'New leads',
};

const activityIcons: Record<ActivityKind, typeof CalendarDays> = {
  followup: CalendarDays,
  call: Phone,
  message: MessageCircle,
  email: Mail,
  lead: Users,
};

const formatDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const startOfMonthGrid = (month: Date): Date => {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  return new Date(first.getFullYear(), first.getMonth(), 1 - mondayOffset);
};

const endOfMonthGrid = (month: Date): Date => {
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const daysToSunday = 6 - ((last.getDay() + 6) % 7);
  return new Date(last.getFullYear(), last.getMonth(), last.getDate() + daysToSunday);
};

const toActivityRecords = (rows: { id: string; created_at: string | null }[] | null, kind: ActivityKind): ActivityRecord[] =>
  (rows || []).filter((row) => row.created_at).map((row) => ({ id: row.id, date: row.created_at as string, kind }));

export default function LeadFollowupHeatmap() {
  const [month, setMonth] = useState(() => new Date());
  const [records, setRecords] = useState<ActivityRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const gridStart = useMemo(() => startOfMonthGrid(month), [month]);
  const gridEnd = useMemo(() => endOfMonthGrid(month), [month]);

  useEffect(() => {
    let cancelled = false;
    const loadActivity = async () => {
      setLoading(true);
      setHasError(false);
      setSelectedDate(null);

      const from = new Date(gridStart);
      from.setHours(0, 0, 0, 0);
      const to = new Date(gridEnd);
      to.setHours(23, 59, 59, 999);
      const fromISO = from.toISOString();
      const toISO = to.toISOString();

      const [activities, followups, emails, calls, messages, leads] = await Promise.all([
        supabase.from('lead_activities').select('id, created_at').gte('created_at', fromISO).lte('created_at', toISO),
        supabase.from('lead_followups').select('id, created_at').gte('created_at', fromISO).lte('created_at', toISO),
        supabase.from('email_log').select('id, created_at').gte('created_at', fromISO).lte('created_at', toISO),
        supabase.from('call_logs').select('id, created_at').gte('created_at', fromISO).lte('created_at', toISO),
        supabase.from('wa_messages').select('id, created_at').gte('created_at', fromISO).lte('created_at', toISO),
        supabase.from('submissions').select('id, created_at').gte('created_at', fromISO).lte('created_at', toISO),
      ]);

      if (cancelled) return;
      const errors = [activities.error, followups.error, emails.error, calls.error, messages.error, leads.error].filter(Boolean);
      if (errors.length === 6) {
        setHasError(true);
        setRecords([]);
      } else {
        setRecords([
          ...toActivityRecords(activities.data, 'followup'),
          ...toActivityRecords(followups.data, 'followup'),
          ...toActivityRecords(emails.data, 'email'),
          ...toActivityRecords(calls.data, 'call'),
          ...toActivityRecords(messages.data, 'message'),
          ...toActivityRecords(leads.data, 'lead'),
        ]);
      }
      setLoading(false);
    };

    void loadActivity();
    return () => { cancelled = true; };
  }, [gridEnd, gridStart]);

  const cells = useMemo<DayCell[]>(() => {
    const result: DayCell[] = [];
    const cursor = new Date(gridStart);
    const last = new Date(gridEnd);
    while (cursor <= last) {
      const key = formatDateKey(cursor);
      result.push({
        date: new Date(cursor),
        key,
        day: cursor.getDate(),
        inMonth: cursor.getMonth() === month.getMonth(),
        activities: records.filter((record) => formatDateKey(new Date(record.date)) === key),
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  }, [gridEnd, gridStart, month, records]);

  const monthCells = cells.filter((cell) => cell.inMonth);
  const maxActivity = Math.max(...monthCells.map((cell) => cell.activities.length), 0);
  const monthTotal = monthCells.reduce((sum, cell) => sum + cell.activities.length, 0);
  const activeDays = monthCells.filter((cell) => cell.activities.length > 0).length;
  const selectedCell = cells.find((cell) => cell.key === selectedDate);
  const selectedCounts = selectedCell?.activities.reduce<Record<ActivityKind, number>>((counts, activity) => {
    counts[activity.kind] += 1;
    return counts;
  }, { followup: 0, call: 0, message: 0, email: 0, lead: 0 });

  const getIntensity = (count: number): string => {
    if (!count || maxActivity === 0) return 'empty';
    const ratio = count / maxActivity;
    if (ratio <= 0.2) return 'low';
    if (ratio <= 0.45) return 'medium';
    if (ratio <= 0.75) return 'high';
    return 'peak';
  };

  const moveMonth = (offset: number) => {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  return (
    <div className="dash-card dash-card-elevated dash-heatmap-card">
      <div className="dash-card-header dash-heatmap-header">
        <div className="dash-card-title">
          <div className="dash-card-icon dash-card-icon-cyan"><CalendarDays size={18} /></div>
          <div>
            <h2>Lead Follow-up Activity</h2>
            <p className="dash-heatmap-subtitle">See when your team is engaging leads</p>
          </div>
          <span className="dash-heatmap-info" title="Darker days have more combined follow-ups, calls, messages, emails, and new leads."><CircleHelp size={15} /></span>
        </div>
        <button className="dash-heatmap-refresh" onClick={() => setMonth(new Date(month))} aria-label="Refresh activity calendar" title="Refresh activity calendar">
          <RefreshCw size={15} />
        </button>
      </div>

      <div className="dash-heatmap-summary">
        <div><strong>{monthTotal}</strong><span>Total activities</span></div>
        <div><strong>{activeDays}</strong><span>Active days</span></div>
        <div><strong>{maxActivity}</strong><span>Peak in one day</span></div>
      </div>

      <div className="dash-heatmap-calendar">
        <div className="dash-heatmap-month-nav">
          <button onClick={() => moveMonth(-1)} aria-label="Previous month"><ChevronLeft size={18} /></button>
          <strong>{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</strong>
          <button onClick={() => moveMonth(1)} aria-label="Next month"><ChevronRight size={18} /></button>
        </div>
        <div className="dash-heatmap-weekdays">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <span key={day}>{day}</span>)}
        </div>
        <div className="dash-heatmap-grid" aria-label={`${month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} lead activity calendar`}>
          {cells.map((cell) => (
            <button
              key={cell.key}
              className={`dash-heatmap-day ${cell.inMonth ? '' : 'dash-heatmap-day-outside'} ${getIntensity(cell.activities.length)} ${selectedDate === cell.key ? 'selected' : ''}`}
              onClick={() => cell.inMonth && setSelectedDate(cell.key)}
              disabled={!cell.inMonth}
              aria-label={`${cell.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}: ${cell.activities.length} activities`}
            >
              <span>{cell.day}</span>
              {cell.activities.length > 0 && <i />}
            </button>
          ))}
        </div>
        <div className="dash-heatmap-legend"><span>Less</span><i className="empty" /><i className="low" /><i className="medium" /><i className="high" /><i className="peak" /><span>More</span></div>
      </div>

      {hasError ? (
        <div className="dash-heatmap-empty">Activity data could not be loaded right now.</div>
      ) : loading ? (
        <div className="dash-heatmap-empty">Loading activity calendar...</div>
      ) : selectedCell ? (
        <div className="dash-heatmap-detail">
          <div className="dash-heatmap-detail-heading">
            <strong>{selectedCell.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</strong>
            <span>{selectedCell.activities.length} total activities</span>
          </div>
          <div className="dash-heatmap-detail-items">
            {(Object.keys(activityLabels) as ActivityKind[]).filter((kind) => (selectedCounts?.[kind] || 0) > 0).map((kind) => {
              const Icon = activityIcons[kind];
              return <span key={kind}><Icon size={14} /> {selectedCounts?.[kind]} {activityLabels[kind]}</span>;
            })}
          </div>
        </div>
      ) : (
        <div className="dash-heatmap-empty">Select a day to see its follow-up activity.</div>
      )}
    </div>
  );
}
