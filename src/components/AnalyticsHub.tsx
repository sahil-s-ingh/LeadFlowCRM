import { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { BarChart3, Activity, TrendingUp } from 'lucide-react';
import EmailAnalytics from './EmailAnalytics';
import LeadActivityTimeline from './LeadActivityTimeline';
import RevenueForecast from './RevenueForecast';

type Tab = 'email_analytics' | 'activity_timeline' | 'revenue_forecast';

interface AnalyticsHubProps {
  session: Session;
  onBack: () => void;
  initialTab?: Tab;
}

const TABS: { key: Tab; label: string; icon: typeof BarChart3; color: string }[] = [
  { key: 'email_analytics', label: 'Email Analytics', icon: BarChart3, color: '#3B82F6' },
  { key: 'activity_timeline', label: 'Activity Timeline', icon: Activity, color: '#06B6D4' },
  { key: 'revenue_forecast', label: 'Revenue Forecast', icon: TrendingUp, color: '#16A34A' },
];

export default function AnalyticsHub({ session, onBack, initialTab = 'email_analytics' }: AnalyticsHubProps) {
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div>
      {/* Tab bar */}
      <div className="ah-tabbar">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              className={`ah-tab ${active ? 'ah-tab-active' : ''}`}
              onClick={() => setTab(t.key)}
              style={active ? { borderBottomColor: t.color, color: t.color } : undefined}
            >
              <t.icon size={17} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active tab content */}
      <div className="ah-content">
        {tab === 'email_analytics' && <EmailAnalytics session={session} onBack={onBack} />}
        {tab === 'activity_timeline' && <LeadActivityTimeline session={session} onBack={onBack} />}
        {tab === 'revenue_forecast' && <RevenueForecast session={session} onBack={onBack} />}
      </div>
    </div>
  );
}
