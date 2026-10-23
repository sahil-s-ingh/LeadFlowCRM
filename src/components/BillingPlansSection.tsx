import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import {
  CreditCard, CheckCircle2, Loader2, Zap, Crown, Users, TrendingUp,
  Sparkles, Calendar, AlertTriangle, Gift,
} from 'lucide-react';

type Plan = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  monthly_price: number;
  annual_price: number;
  currency: string;
  lead_limit: number | null;
  team_seats: number | null;
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
  features: string[] | null;
  cta_label: string | null;
};

type Subscription = {
  id: string;
  plan_id: string | null;
  status: string;
  billing_cycle: 'monthly' | 'annual' | null;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  plan: Plan | null;
};

const currencySymbol = (c: string) => c === 'INR' ? '\u20B9' : c === 'EUR' ? '\u20AC' : c === 'GBP' ? '\u00A3' : '$';

const planIcon = (slug: string) => {
  if (slug === 'free') return <Sparkles size={22} style={{ color: '#64748b' }} />;
  if (slug === 'enterprise') return <Crown size={22} style={{ color: '#eab308' }} />;
  if (slug === 'pro') return <Zap size={22} style={{ color: '#2563eb' }} />;
  return <TrendingUp size={22} style={{ color: '#0f766e' }} />;
};

export default function BillingPlansSection({ session }: { session: Session }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [leadCount, setLeadCount] = useState(0);
  const [teamCount, setTeamCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [isFreeMode, setIsFreeMode] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);

    const { data: billingToggle } = await supabase
      .from('feature_toggles')
      .select('is_enabled')
      .eq('key', 'platform_billing_mode')
      .maybeSingle();
    setIsFreeMode(billingToggle ? !billingToggle.is_enabled : false);

    const { data: planData } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    const activePlans = (planData || []) as unknown as Plan[];
    setPlans(activePlans);

    const { data: subData } = await supabase
      .from('account_subscriptions')
      .select('*, plan:subscription_plans(*)')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (subData) setSubscription(subData as unknown as Subscription);

    const { count } = await supabase
      .from('submissions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.user.id)
      .is('deleted_at', null);
    setLeadCount(count || 0);

    const { count: tc } = await supabase
      .from('team_members')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', session.user.id)
      .eq('status', 'active');
    setTeamCount(tc || 0);

    setLoading(false);
  }, [session.user.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleUpgrade = (plan: Plan) => {
    if (plan.slug === 'free' && subscription?.plan?.slug === 'free') return;
    if (plan.slug === subscription?.plan?.slug) return;
    setCheckoutLoading(true);
    window.dispatchEvent(new Event('open-mt5-setup'));
    window.setTimeout(() => setCheckoutLoading(false), 1000);
  };

  const formatDate = (d: string | null) => {
    if (!d) return '\u2014';
    return new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const currentPlan = subscription?.plan || null;
  const currentPlanSlug = currentPlan?.slug || 'free';
  const leadLimit = currentPlan?.lead_limit ?? 0;
  const teamSeats = currentPlan?.team_seats ?? 1;

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
        <Loader2 size={28} className="crm-spin" style={{ color: '#0f766e' }} />
      </div>
    );
  }

  if (isFreeMode) {
    return (
      <>
        <div className="crm-settings-card-header">
          <h2 className="crm-settings-card-title"><CreditCard size={20} style={{ color: '#16a34a' }} /> Billing & Plans</h2>
          <p className="crm-settings-card-desc">Your plan details and usage.</p>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, rgba(22,163,74,0.08), rgba(15,118,110,0.05))',
          border: '1px solid rgba(22,163,74,0.2)',
          borderRadius: '12px',
          padding: '32px',
          textAlign: 'center',
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'rgba(22,163,74,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <Gift size={28} style={{ color: '#16a34a' }} />
          </div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 8px' }}>
            You're on the Free Platform Plan
          </h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto', lineHeight: 1.6 }}>
            The platform is currently in free mode. You have unlimited access to all features — no lead limits, no team seat restrictions, and no billing required. Enjoy!
          </p>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '24px',
            marginTop: '20px',
            flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#16a34a', fontWeight: 600 }}>
              <CheckCircle2 size={16} /> Unlimited Leads
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#16a34a', fontWeight: 600 }}>
              <CheckCircle2 size={16} /> Unlimited Team Seats
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#16a34a', fontWeight: 600 }}>
              <CheckCircle2 size={16} /> All Features Unlocked
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="crm-settings-card-header">
        <h2 className="crm-settings-card-title"><CreditCard size={20} style={{ color: '#2563eb' }} /> Billing & Plans</h2>
        <p className="crm-settings-card-desc">View your current plan, usage, and upgrade to unlock more leads and team seats.</p>
      </div>

      {/* Current Plan Card */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(37,99,235,0.06), rgba(15,118,110,0.04))',
        border: '1px solid rgba(37,99,235,0.15)',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              {planIcon(currentPlanSlug)}
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                {currentPlan?.name || 'Free Plan'}
              </h3>
              <span style={{
                padding: '3px 10px',
                borderRadius: '20px',
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                background: subscription?.status === 'active' ? 'rgba(22,163,74,0.12)' : subscription?.status === 'trial' ? 'rgba(234,179,8,0.12)' : 'rgba(100,116,139,0.12)',
                color: subscription?.status === 'active' ? '#16a34a' : subscription?.status === 'trial' ? '#ca8a04' : '#64748b',
              }}>
                {subscription?.status || 'Free'}
              </span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
              {currentPlan?.description || 'Basic access with limited leads and a single seat.'}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {currentPlan ? `${currencySymbol(currentPlan.currency)}${subscription?.billing_cycle === 'annual' ? currentPlan.annual_price : currentPlan.monthly_price}` : `${currencySymbol('USD')}0`}
              <span style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-muted)' }}>/mo</span>
            </div>
            {subscription?.billing_cycle === 'annual' && (
              <span style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600 }}>Billed annually</span>
            )}
          </div>
        </div>

        {/* Renewal / Trial info */}
        {subscription && subscription.status !== 'free' && (
          <div style={{ display: 'flex', gap: '16px', marginTop: '16px', flexWrap: 'wrap' }}>
            {subscription.trial_ends_at && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#ca8a04' }}>
                <Calendar size={14} /> Trial ends {formatDate(subscription.trial_ends_at)}
              </div>
            )}
            {subscription.current_period_end && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <Calendar size={14} /> Renews on {formatDate(subscription.current_period_end)}
              </div>
            )}
          </div>
        )}

        {/* Usage bars */}
        <div style={{ marginTop: '20px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1', minWidth: '180px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Users size={14} /> Leads
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {leadCount} / {leadLimit === 0 ? '\u221E' : leadLimit}
              </span>
            </div>
            <div style={{ height: '8px', background: 'var(--bg-light)', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
              <div style={{
                height: '100%',
                width: leadLimit > 0 ? `${Math.min(100, (leadCount / leadLimit) * 100)}%` : '100%',
                background: leadLimit > 0 && leadCount >= leadLimit ? '#ef4444' : leadLimit > 0 && leadCount >= leadLimit * 0.8 ? '#eab308' : '#2563eb',
                borderRadius: '4px',
                transition: 'width 0.4s ease',
              }} />
            </div>
            {leadLimit > 0 && leadCount >= leadLimit && (
              <p style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlertTriangle size={12} /> Lead limit reached. Upgrade to add more leads.
              </p>
            )}
          </div>

          <div style={{ flex: '1', minWidth: '180px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Users size={14} /> Team Seats
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {teamCount} / {teamSeats}
              </span>
            </div>
            <div style={{ height: '8px', background: 'var(--bg-light)', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
              <div style={{
                height: '100%',
                width: teamSeats > 0 ? `${Math.min(100, (teamCount / teamSeats) * 100)}%` : '0%',
                background: teamSeats > 0 && teamCount >= teamSeats ? '#ef4444' : '#0f766e',
                borderRadius: '4px',
                transition: 'width 0.4s ease',
              }} />
            </div>
          </div>
        </div>
      </div>

      {/* Billing cycle toggle */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
        <div style={{
          display: 'inline-flex',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px',
          overflow: 'hidden',
          background: 'var(--bg-card)',
        }}>
          <button
            type="button"
            onClick={() => setBillingCycle('monthly')}
            style={{
              padding: '8px 20px',
              border: 'none',
              background: billingCycle === 'monthly' ? '#2563eb' : 'transparent',
              color: billingCycle === 'monthly' ? '#fff' : 'var(--text-muted)',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('yearly')}
            style={{
              padding: '8px 20px',
              border: 'none',
              background: billingCycle === 'yearly' ? '#2563eb' : 'transparent',
              color: billingCycle === 'yearly' ? '#fff' : 'var(--text-muted)',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            Yearly
            <span style={{
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '0.68rem',
              fontWeight: 700,
              background: billingCycle === 'yearly' ? 'rgba(255,255,255,0.2)' : 'rgba(22,163,74,0.12)',
              color: billingCycle === 'yearly' ? '#fff' : '#16a34a',
            }}>SAVE 20%</span>
          </button>
        </div>
      </div>

      {/* Plan cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
        {plans.map((plan) => {
          const isCurrent = plan.slug === currentPlanSlug;
          const price = billingCycle === 'monthly' ? plan.monthly_price : plan.annual_price;
          const features = plan.features || [];

          return (
            <div
              key={plan.id}
              style={{
                position: 'relative',
                border: plan.is_featured ? '2px solid #2563eb' : '1px solid var(--border-subtle)',
                borderRadius: '12px',
                padding: '20px',
                background: plan.is_featured ? 'rgba(37,99,235,0.03)' : 'var(--bg-card)',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {plan.is_featured && (
                <span style={{
                  position: 'absolute',
                  top: '-10px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  padding: '3px 12px',
                  borderRadius: '20px',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  background: '#2563eb',
                  color: '#fff',
                  whiteSpace: 'nowrap',
                }}>
                  MOST POPULAR
                </span>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                {planIcon(plan.slug)}
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>{plan.name}</h3>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  {currencySymbol(plan.currency)}{price}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>/mo</span>
                {billingCycle === 'yearly' && price > 0 && (
                  <p style={{ fontSize: '0.7rem', color: '#16a34a', marginTop: '2px' }}>
                    {currencySymbol(plan.currency)}{plan.annual_price} billed annually
                  </p>
                )}
              </div>

              <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.5, minHeight: '33px' }}>
                {plan.description || ''}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', color: 'var(--text-dark)' }}>
                  <Users size={14} style={{ color: '#64748b' }} />
                  {plan.lead_limit === 0 || plan.lead_limit === null ? 'Unlimited leads' : `${plan.lead_limit.toLocaleString()} leads`}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', color: 'var(--text-dark)' }}>
                  <Users size={14} style={{ color: '#64748b' }} />
                  {plan.team_seats === 0 || plan.team_seats === null ? 'Unlimited seats' : `${plan.team_seats} team seats`}
                </div>
                {features.slice(0, 4).map((feat, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '0.76rem', color: 'var(--text-dark)' }}>
                    <CheckCircle2 size={14} style={{ color: '#16a34a', flexShrink: 0, marginTop: '1px' }} />
                    {feat}
                  </div>
                ))}
              </div>

              <button
                type="button"
                disabled={isCurrent || checkoutLoading}
                onClick={() => handleUpgrade(plan)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: isCurrent ? 'none' : plan.is_featured ? 'none' : '1px solid var(--border-subtle)',
                  background: isCurrent ? 'var(--bg-light)' : plan.is_featured ? '#2563eb' : 'var(--bg-card)',
                  color: isCurrent ? 'var(--text-muted)' : plan.is_featured ? '#fff' : 'var(--text-main)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: isCurrent ? 'default' : 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
                onMouseEnter={(e) => { if (!isCurrent && !checkoutLoading) { e.currentTarget.style.background = plan.is_featured ? '#1e40af' : 'var(--bg-light)'; } }}
                onMouseLeave={(e) => { if (!isCurrent && !checkoutLoading) { e.currentTarget.style.background = plan.is_featured ? '#2563eb' : 'var(--bg-card)'; } }}
              >
                {checkoutLoading && !isCurrent ? (
                  <Loader2 size={14} className="crm-spin" />
                ) : isCurrent ? (
                  <><CheckCircle2 size={14} /> Current Plan</>
                ) : (
                  <>{plan.cta_label || (plan.slug === 'free' ? 'Downgrade' : 'Upgrade')}</>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {plans.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          No plans available. Please contact support.
        </div>
      )}
    </>
  );
}
