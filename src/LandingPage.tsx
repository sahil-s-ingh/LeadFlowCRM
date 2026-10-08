import { useEffect, useState, useRef, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { DEFAULT_PALETTE, type LandingPalette } from '@/lib/colorPalette';
import PopupFormModal from '@/components/PopupFormModal';

const DEFAULT_TELEGRAM_URL = '#crm-signup';
const OPEN_SETUP_EVENT = 'open-mt5-setup';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

function initMetaPixel(pixelId: string) {
  if (window.fbq) return;
  (function (f: Window, b: Document, e: string, v: string) {
    let n: Element | null = f.fbq ? null : b.createElement(e);
    if (f.fbq) return;
    (f.fbq as unknown) = function () {
      (f.fbq as unknown as { callMethod?: (...a: unknown[]) => void }).callMethod
        ? (f.fbq as unknown as { callMethod: (...a: unknown[]) => void }).callMethod.apply(f.fbq, arguments as unknown as unknown[])
        : (f.fbq as unknown as { queue?: unknown[] }).queue
          ? (f.fbq as unknown as { queue: unknown[] }).queue.push(arguments as unknown as unknown[])
          : ((f.fbq as unknown as { queue?: unknown[] }).queue = [], (f.fbq as unknown as { queue: unknown[] }).queue.push(arguments as unknown as unknown[]));
    };
    if (!f._fbq) f._fbq = f;
    (f.fbq as unknown as { loaded?: boolean; version?: string }).loaded = true;
    (f.fbq as unknown as { version?: string }).version = '2.0';
    (f.fbq as unknown as { queue?: unknown[] }).queue = [];
    const t = b.createElement(e);
    t.async = true;
    t.src = v;
    const s = b.getElementsByTagName(e)[0];
    s.parentNode?.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  window.fbq?.('init', pixelId);
  window.fbq?.('track', 'PageView');
}

function trackMetaLeadEvent() {
  if (window.fbq) {
    window.fbq('track', 'Lead', { content_name: 'Landing Page Signup' });
  }
}

/** Fetch the saved landing page color palette. When enabled, applies CSS variables to the document root. */
function useLandingPalette(): LandingPalette | null {
  const [palette, setPalette] = useState<LandingPalette | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('landing_page_appearance')
        .select('*')
        .maybeSingle();

      if (data) {
        const pixelId = (data as { meta_pixel_id?: string }).meta_pixel_id;
        if (pixelId) {
          initMetaPixel(pixelId);
        }
      }

      if (data && (data as { enabled: boolean }).enabled) {
        const d = data as { primary_color: string; primary_light: string | null; primary_dark: string | null; accent: string | null; accent_dark: string | null; background: string | null; surface: string | null; surface_tint: string | null; text: string | null; text_muted: string | null; border: string | null; button_bg: string | null; button_text: string | null; button_hover: string | null; badge_bg: string | null; badge_text: string | null; footer_bg: string | null; footer_text: string | null };
        const p: LandingPalette = {
          primary: d.primary_color || DEFAULT_PALETTE.primary,
          primaryLight: d.primary_light || DEFAULT_PALETTE.primaryLight,
          primaryDark: d.primary_dark || DEFAULT_PALETTE.primaryDark,
          accent: d.accent || DEFAULT_PALETTE.accent,
          accentDark: d.accent_dark || DEFAULT_PALETTE.accentDark,
          background: d.background || DEFAULT_PALETTE.background,
          surface: d.surface || DEFAULT_PALETTE.surface,
          surfaceTint: d.surface_tint || DEFAULT_PALETTE.surfaceTint,
          text: d.text || DEFAULT_PALETTE.text,
          textMuted: d.text_muted || DEFAULT_PALETTE.textMuted,
          border: d.border || DEFAULT_PALETTE.border,
          buttonBg: d.button_bg || DEFAULT_PALETTE.buttonBg,
          buttonText: d.button_text || DEFAULT_PALETTE.buttonText,
          buttonHover: d.button_hover || DEFAULT_PALETTE.buttonHover,
          badgeBg: d.badge_bg || DEFAULT_PALETTE.badgeBg,
          badgeText: d.badge_text || DEFAULT_PALETTE.badgeText,
          footerBg: d.footer_bg || DEFAULT_PALETTE.footerBg,
          footerText: d.footer_text || DEFAULT_PALETTE.footerText,
        };
        setPalette(p);
        const root = document.documentElement;
        root.style.setProperty('--landing-primary', p.primary);
        root.style.setProperty('--landing-primary-light', p.primaryLight);
        root.style.setProperty('--landing-primary-dark', p.primaryDark);
        root.style.setProperty('--landing-accent', p.accent);
        root.style.setProperty('--landing-bg', p.background);
        root.style.setProperty('--landing-surface', p.surface);
        root.style.setProperty('--landing-text', p.text);
        root.style.setProperty('--landing-text-muted', p.textMuted);
        root.style.setProperty('--landing-border', p.border);
        root.style.setProperty('--landing-btn-bg', p.buttonBg);
        root.style.setProperty('--landing-btn-text', p.buttonText);
        root.style.setProperty('--landing-btn-hover', p.buttonHover);
        root.style.setProperty('--landing-badge-bg', p.badgeBg);
        root.style.setProperty('--landing-badge-text', p.badgeText);
        root.style.setProperty('--landing-footer-bg', p.footerBg);
        root.style.setProperty('--landing-footer-text', p.footerText);
      }
    })();
  }, []);

  return palette;
}

/** Fetch the signup link configured in Settings (publicly readable column). */
function useTelegramLink() {
  const [link, setLink] = useState(DEFAULT_TELEGRAM_URL);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('telegram_settings')
        .select('telegram_link')
        .maybeSingle();
      if (data?.telegram_link) setLink(data.telegram_link);
    })();
  }, []);
  return link;
}

type CrmProduct = 'starter' | 'pro' | '';

type SetupForm = {
  fullName: string;
  mobileNumber: string;
  email: string;
  state: string;
  crmProduct: CrmProduct;
  teamSize: string;
};

const initialSetupForm: SetupForm = {
  fullName: '',
  mobileNumber: '',
  email: '',
  state: '',
  crmProduct: '',
  teamSize: '',
};

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

// ===================== Countdown Timer Hook =====================
function useCountdown() {
  const [secondsLeft, setSecondsLeft] = useState(14 * 60 + 59);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev > 0) return prev - 1;
        return 15 * 60;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// ===================== Offer Item Reveal Hook =====================
function useOfferReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animated-in');
          }
        });
      },
      { threshold: 0.15 }
    );
    document.querySelectorAll('.offer-item').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

// ===================== Social Proof Toast Hook =====================
const joiners = [
  { name: 'Rahul S.', city: 'Delhi', time: '1 min ago', action: 'started a 14-day CRM free trial!' },
  { name: 'Priya K.', city: 'Jaipur', time: 'Just now', action: 'imported 500 leads into LeadFlow CRM!' },
  { name: 'Siddharth V.', city: 'Mumbai', time: '2 mins ago', action: 'closed 3 deals using the sales pipeline!' },
  { name: 'Amit B.', city: 'Bengaluru', time: 'Just now', action: 'automated follow-ups with LeadFlow CRM!' },
  { name: 'Neha Sharma', city: 'Chandigarh', time: '3 mins ago', action: 'unlocked WhatsApp broadcast feature!' },
  { name: 'Karan Verma', city: 'Pune', time: 'Just now', action: 'claimed free CRM dashboard access!' },
];

function useSocialToast() {
  const [toastData, setToastData] = useState(joiners[0]);
  const [show, setShow] = useState(false);
  const indexRef = useRef(0);

  useEffect(() => {
    const showNext = () => {
      const j = joiners[indexRef.current];
      setToastData(j);
      setShow(true);
      setTimeout(() => setShow(false), 4000);
      indexRef.current = (indexRef.current + 1) % joiners.length;
    };

    const initialTimer = setTimeout(showNext, 3000);
    const interval = setInterval(showNext, 12000);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []);

  const initials = toastData.name.split(' ').map((n) => n[0]).join('');

  return { toastData, show, initials };
}

// ===================== Top Urgency Bar =====================
function TopUrgencyBar() {
  const countdown = useCountdown();

  return (
    <div
      style={{
        background: 'linear-gradient(90deg, #FFFBEB 0%, #FEF3C7 50%, #FFFBEB 100%)',
        color: '#92400E',
        fontSize: '0.76rem',
        fontWeight: 800,
        textAlign: 'center',
        padding: '7px 12px',
        position: 'relative',
        zIndex: 101,
        letterSpacing: '0.2px',
        boxShadow: '0 1px 4px rgba(0, 0, 0, 0.03)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        borderBottom: '1px solid #FCD34D',
      }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#D97706', display: 'inline-block', verticalAlign: '-1px' }}>
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
      <span>Free CRM Trial Closes In</span>
      <div
        style={{
          background: '#78350F',
          color: '#FDE68A',
          padding: '2px 7px',
          borderRadius: '4px',
          fontFamily: 'monospace',
          fontSize: '0.8rem',
          fontWeight: 900,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        }}
      >
        {countdown}
      </div>
      <span style={{ display: 'inline-block', width: 4, height: 4, backgroundColor: '#D97706', borderRadius: '50%' }} />
      <span>Limited Trial Spots</span>
    </div>
  );
}

// ===================== Header =====================
function Header() {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        left: 0,
        width: '100%',
        height: '58px',
        background: 'rgba(255, 255, 255, 0.94)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <div style={{ width: '100%', maxWidth: 960, margin: '0 auto', padding: '0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <a href="#" style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: '1.15rem', letterSpacing: '-0.3px', color: 'var(--landing-text, #0F172A)', textDecoration: 'none' }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: 'linear-gradient(135deg, #FEF08A, #EAB308)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `2px solid var(--landing-primary, #EAB308)`, boxShadow: '0 2px 6px rgba(234, 179, 8, 0.25)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#422006" strokeWidth="2.5"><path d="M3 17l6-6 4 4 8-8"/><path d="M21 7v4h-4"/></svg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 900, lineHeight: 1.1, fontSize: '1.05rem' }}>LeadFlow CRM</span>
            <span style={{ fontSize: '0.65rem', color: '#CA8A04', fontWeight: 800, letterSpacing: '0.4px' }}>SALES &amp; LEAD MANAGEMENT</span>
          </div>
        </a>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(22, 163, 74, 0.1)',
            border: '1px solid rgba(22, 163, 74, 0.3)',
            color: '#15803D',
            padding: '3px 9px',
            borderRadius: '9999px',
            fontSize: '0.7rem',
            fontWeight: 800,
          }}
        >
          <span className="live-dot" />
          <span>14-DAY FREE TRIAL</span>
        </div>
      </div>
    </header>
  );
}

// ===================== Hero =====================
function Hero() {
  const telegramLink = useTelegramLink();
  return (
    <section style={{ paddingTop: 24, paddingBottom: 32, textAlign: 'center', position: 'relative' }}>
      <div
        style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: '0 16px',
        }}
      >
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(234, 179, 8, 0.25)',
            borderRadius: 20,
            padding: '24px 18px',
            boxShadow: '0 12px 35px rgba(234, 179, 8, 0.08), 0 1px 3px rgba(0, 0, 0, 0.02)',
            position: 'relative',
          }}
        >
          {/* Badge */}
          <div style={{ marginBottom: 12 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '6px 14px',
                background: `linear-gradient(135deg, var(--landing-primary-light, #FEF08A) 0%, var(--landing-primary, #EAB308) 100%)`,
                color: '#000000',
                border: `1px solid var(--landing-primary, rgba(234, 179, 8, 0.6))`,
                borderRadius: '9999px',
                fontSize: '0.78rem',
                fontWeight: 900,
                boxShadow: '0 3px 12px rgba(234, 179, 8, 0.3)',
              }}
            >
              <span className="live-dot-pulse" />
              <span>14-Day Free Trial &bull; 5,000+ Businesses</span>
            </span>
          </div>

          {/* Title */}
          <h1
            style={{
              fontFamily: 'Outfit, sans-serif',
              fontSize: '1.95rem',
              fontWeight: 900,
              letterSpacing: '-0.2px',
              marginBottom: 12,
              lineHeight: 1.35,
              color: 'var(--landing-text, #0F172A)',
            }}
          >
            Close More Deals With <span className="text-gold-gradient">LeadFlow CRM</span>
          </h1>

          {/* Description */}
          <p
            style={{
              fontSize: '0.92rem',
              color: 'var(--landing-text-muted, #475569)',
              marginBottom: 18,
              lineHeight: 1.55,
              maxWidth: 620,
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            Manage leads, automate follow-ups, broadcast on WhatsApp &amp; Email, and track your entire sales pipeline — all from one powerful CRM dashboard built for growing sales teams.
          </p>

          {/* Seat Progress */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1.5px solid rgba(234, 179, 8, 0.4)',
              borderRadius: 14,
              padding: '10px 14px',
              maxWidth: 440,
              margin: '0 auto 20px auto',
              textAlign: 'left',
              boxShadow: '0 4px 14px rgba(234, 179, 8, 0.08)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontWeight: 800, marginBottom: 6 }}>
              <span style={{ color: '#854D0E', display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#D97706' }}>
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                Free CRM Trial Spots
              </span>
              <span style={{ color: '#0F172A', display: 'flex', alignItems: 'center', gap: 4 }}>
                481/500 Claimed
              </span>
            </div>
            <div style={{ width: '100%', height: 8, background: 'rgba(0, 0, 0, 0.06)', borderRadius: '9999px', overflow: 'hidden', position: 'relative' }}>
              <div
                className="progress-fill-anim"
                style={{
                  height: '100%',
                  width: '96%',
                  background: 'linear-gradient(90deg, #EAB308 0%, #F59E0B 50%, #CA8A04 100%)',
                  borderRadius: '9999px',
                  boxShadow: '0 1px 4px rgba(234, 179, 8, 0.4)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              />
            </div>
            <div style={{ textAlign: 'right', marginTop: 4, fontSize: '0.72rem', fontWeight: 800, color: '#D97706' }}>
              96% Full
            </div>
          </div>

          {/* CTA */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', maxWidth: 460, margin: '0 auto' }}>
            <a href="#signup" onClick={(event) => { event.preventDefault(); window.location.hash = 'signup'; }} className="gold-cta">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span>START FREE TRIAL &amp; GET CRM ACCESS</span>
            </a>
            <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: 5 }}>
              Instant Access &bull; No Credit Card Required
            </span>
          </div>

          {/* Hero Badges */}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 16 }}>
            {[
              { icon: 'bot', label: 'Lead Pipeline Management' },
              { icon: 'video', label: 'WhatsApp &amp; Email Broadcast' },
              { icon: 'shield', label: 'Automated Follow-ups' },
            ].map((b) => (
              <span
                key={b.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  background: '#FFFFFF',
                  border: '1px solid rgba(0, 0, 0, 0.08)',
                  padding: '5px 11px',
                  borderRadius: '9999px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: '#0F172A',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)',
                }}
              >
                <BadgeIconSvg type={b.icon} />
                {b.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ===================== Badge Icon Helper =====================
function BadgeIconSvg({ type }: { type: string }) {
  const icons: Record<string, React.ReactNode> = {
    bot: (
      <path d="M12 8V4H8a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4M8 10H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-4M9 20v-4h3v4" />
    ),
    video: (
      <>
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </>
    ),
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
    book: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </>
    ),
    users: (
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    zap: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
    chart: (
      <>
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </>
    ),
    target: (
      <>
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </>
    ),
    graduation: (
      <>
        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
        <path d="M6 12v5c3 3 9 3 12 0v-5" />
      </>
    ),
  };

  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#16A34A', flexShrink: 0 }}>
      {icons[type] || icons.bot}
    </svg>
  );
}

// ===================== Stats Bar =====================
function useCountUp(target: number, durationMs: number, start: boolean) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    const startTime = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, start]);
  return value;
}

function StatsBar() {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) setVisible(true);
    }, { threshold: 0.3 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const businesses = useCountUp(5000, 2000, visible);
  const leadsDaily = useCountUp(50000, 2200, visible);

  const stats = [
    { num: visible ? `${businesses.toLocaleString('en-IN')}+` : '5,000+', label: 'Businesses Onboard' },
    { num: '14 Days', label: 'Free CRM Trial' },
    { num: visible ? `${leadsDaily.toLocaleString('en-IN')}+` : '50K+', label: 'Leads Managed Daily' },
    { num: '24/7', label: 'Automation & Support' },
  ];

  return (
    <div
      ref={ref}
      style={{
        padding: '20px 0',
        background: '#FFFFFF',
        borderTop: '1px solid rgba(0, 0, 0, 0.06)',
        borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
        marginBottom: 50,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
      }}
    >
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, textAlign: 'center' }} className="stats-grid">
        {stats.map((s) => (
          <div key={s.label} style={{ padding: 4 }}>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.55rem', fontWeight: 900, color: '#CA8A04', marginBottom: 2, lineHeight: 1.1 }}>{s.num}</div>
            <div style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===================== Section Header =====================
function SectionHeader({ pill, title, desc }: { pill: string; title: React.ReactNode; desc?: string }) {
  return (
    <div style={{ textAlign: 'center', maxWidth: 650, margin: '0 auto 32px auto', padding: '0 16px' }}>
      <span
        style={{
          display: 'inline-block',
          padding: '3px 10px',
          background: 'rgba(234, 179, 8, 0.15)',
          border: '1px solid rgba(234, 179, 8, 0.4)',
          color: '#854D0E',
          borderRadius: '9999px',
          fontSize: '0.72rem',
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.8px',
          marginBottom: 8,
        }}
      >
        {pill}
      </span>
      <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.75rem', fontWeight: 900, marginBottom: 10, lineHeight: 1.35, letterSpacing: '-0.2px', color: '#0F172A' }}>
        {title}
      </h2>
      {desc && <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: 1.55 }}>{desc}</p>}
    </div>
  );
}

// ===================== About Section =====================
function About() {
  return (
    <section id="about" style={{ paddingBottom: 55 }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px' }}>
        <SectionHeader pill="MEET THE TEAM" title="WHO BUILT LEADFLOW CRM?" />
        <div
          style={{
            background: '#FFFDF5',
            border: '1.5px solid #EAB308',
            borderRadius: 20,
            padding: '24px 18px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.05)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 4, background: 'linear-gradient(135deg, #FEF08A 0%, #EAB308 50%, #CA8A04 100%)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center' }} className="about-grid">
            {/* Avatar */}
            <div style={{ position: 'relative', width: 135, height: 135, flexShrink: 0 }} className="about-avatar-wrapper">
              <div
                style={{
                  width: 135,
                  height: 135,
                  borderRadius: '50%',
                  border: '3px solid #EAB308',
                  boxShadow: '0 4px 16px rgba(234, 179, 8, 0.25)',
                  background: 'linear-gradient(135deg, #FEF08A 0%, #EAB308 50%, #CA8A04 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                className="about-avatar"
              >
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#422006" strokeWidth="2"><path d="M3 17l6-6 4 4 8-8"/><path d="M21 7v4h-4"/></svg>
              </div>
              <div
                style={{
                  position: 'absolute',
                  bottom: -8,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'linear-gradient(135deg, #FEF08A 0%, #EAB308 50%, #CA8A04 100%)',
                  color: '#000000',
                  fontWeight: 900,
                  fontSize: '0.7rem',
                  padding: '3px 10px',
                  borderRadius: '9999px',
                  whiteSpace: 'nowrap',
                  border: '1px solid #CA8A04',
                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.12)',
                }}
              >
                5+ YRS EXP
              </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1 }} className="about-content">
              <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.3rem', fontWeight: 800, marginBottom: 3, color: '#0F172A' }}>LeadFlow CRM Team</h3>
              <span style={{ fontSize: '0.82rem', color: '#CA8A04', fontWeight: 800, marginBottom: 12, display: 'block' }}>
                Built by Sales Experts for Sales Teams
              </span>
              <p style={{ fontSize: '0.86rem', color: '#0F172A', lineHeight: 1.55, marginBottom: 14 }}>
                We built LeadFlow CRM after <strong>5+ years of managing sales teams</strong> and seeing the same problems everywhere — leads falling through cracks, no follow-up tracking, scattered WhatsApp chats, and no clear sales pipeline. So we put all our experience into one <strong>all-in-one CRM platform</strong> that handles lead management, automated follow-ups, WhatsApp &amp; Email broadcasts, team collaboration, and sales analytics — all from a single dashboard.
              </p>
              {/* Compliance Box */}
              <div
                style={{
                  background: '#FFFFFF',
                  border: '1px solid rgba(0, 0, 0, 0.08)',
                  borderLeft: '4px solid #16A34A',
                  padding: '12px 14px',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  textAlign: 'left',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#16A34A', flexShrink: 0, marginTop: 2 }}>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <p style={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.45 }}>
                  <strong style={{ color: '#0F172A' }}>Secure &amp; Reliable:</strong> Your data is encrypted and securely stored. We never share or sell your lead data. LeadFlow CRM is built with enterprise-grade security and regular backups to keep your business safe.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ===================== Gift Stack Section =====================
function GiftStack() {
  useOfferReveal();
  const telegramLink = useTelegramLink();

  const gifts = [
    {
      iconType: 'bot',
      title: "Full Lead Pipeline Management",
      subtitle: '(Drag-and-drop Sales Stages)',
      price: '\u20B950,000',
      desc: "Track every lead from first contact to closed deal with a visual pipeline. Drag leads between stages, assign to team members, and never lose track of a deal again.",
      delay: '0.1s',
    },
    {
      iconType: 'video',
      title: 'WhatsApp &amp; Email Broadcast',
      price: '\u20B94,999',
      desc: 'Send bulk WhatsApp messages and email campaigns directly from your CRM. Reach thousands of leads with personalized messages in one click.',
      delay: '0.2s',
    },
    {
      iconType: 'book',
      title: 'Automated Follow-up Scheduler',
      price: '\u20B92,999',
      desc: 'Set automatic follow-up reminders for every lead. The CRM notifies your team when it&apos;s time to follow up, so no lead ever slips through the cracks.',
      delay: '0.3s',
    },
    {
      iconType: 'users',
      title: 'Team Collaboration &amp; Chat',
      price: '\u20B93,999',
      desc: 'Built-in team chat, lead assignment, role-based permissions, and a shared dashboard so your entire sales team stays aligned and productive.',
      delay: '0.4s',
    },
  ];

  return (
    <section id="gifts" style={{ paddingBottom: 55 }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px' }}>
        <SectionHeader pill="WHAT YOU GET" title={<>YOUR CRM <span className="text-gold-gradient">FEATURE STACK</span></>} desc="Here is everything included when you start your LeadFlow CRM free trial today:" />

        <div
          style={{
            background: '#FFFDF5',
            border: '1.5px solid #EAB308',
            borderRadius: 20,
            padding: '34px 16px 24px 16px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.05), 0 8px 25px rgba(234, 179, 8, 0.15)',
            position: 'relative',
          }}
        >
          {/* Corner Badge */}
          <div
            className="offer-badge-corner"
            style={{
              position: 'absolute',
              top: 14,
              right: 14,
              background: 'linear-gradient(135deg, #FEF08A 0%, #EAB308 50%, #CA8A04 100%)',
              color: '#000',
              fontWeight: 900,
              fontSize: '0.72rem',
              padding: '5px 14px',
              borderRadius: '9999px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              boxShadow: '0 4px 14px rgba(234, 179, 8, 0.4)',
              border: '1px solid #CA8A04',
              zIndex: 2,
            }}
          >
            14-DAY FREE TRIAL
          </div>

          {/* Offer Items */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14, marginBottom: 22 }} className="offer-grid">
            {gifts.map((gift, i) => (
              <div key={i} className="offer-item" style={{ transitionDelay: gift.delay }}>
                <div className="offer-icon-box">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <GiftIconSvg type={gift.iconType} />
                  </svg>
                </div>
                <div style={{ flex: 1 }} className="offer-details">
                  <h4 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.98rem', lineHeight: 1.38, color: '#0F172A', marginBottom: 6, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, fontWeight: 800 }}>
                    <span>
                      {gift.title}
                      {gift.subtitle && <span style={{ fontSize: '0.82em', fontWeight: 700, color: '#CA8A04', display: 'inline-block' }}> {gift.subtitle}</span>}
                    </span>
                    <span className="offer-val">{gift.price}</span>
                  </h4>
                  <p style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.45 }}>{gift.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Summary Box */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1.5px dashed #EAB308',
              borderRadius: 14,
              padding: 16,
              textAlign: 'center',
              marginBottom: 20,
              boxShadow: '0 4px 15px rgba(234, 179, 8, 0.1)',
            }}
          >
            <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: 2 }}>
              Total Value: <span style={{ textDecoration: 'line-through', color: '#EF4444', fontWeight: 700 }}>{'\u20B9'}61,997</span>
            </div>
            <div className="offer-free-price">YOUR PRICE: 14 DAYS FREE</div>
          </div>

          {/* CTA */}
          <div style={{ textAlign: 'center' }}>
            <a href="#signup" onClick={(event) => { event.preventDefault(); window.location.hash = 'signup'; }} className="gold-cta" style={{ margin: '0 auto' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span>START FREE TRIAL &amp; GET CRM ACCESS</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

// ===================== Gift Icon Helper =====================
function GiftIconSvg({ type }: { type: string }) {
  const icons: Record<string, React.ReactNode> = {
    bot: (
      <>
        <rect x="3" y="11" width="18" height="10" rx="2" />
        <circle cx="12" cy="5" r="2" />
        <path d="M12 7v4" />
        <line x1="8" y1="16" x2="8" y2="16" />
        <line x1="16" y1="16" x2="16" y2="16" />
      </>
    ),
    video: (
      <>
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </>
    ),
    book: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </>
    ),
    users: (
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
  };
  return <>{icons[type] || icons.bot}</>;
}

// ===================== Curriculum Section =====================
function Curriculum() {
  const items = [
    { iconType: 'bot', title: 'Lead Pipeline Management', desc: 'Track every lead from first contact to closed deal with a visual drag-and-drop pipeline. Assign leads to team members and move them through stages effortlessly.' },
    { iconType: 'zap', title: 'Automated Follow-up Reminders', desc: 'Set automatic follow-up schedules for every lead. The CRM notifies your team when it\'s time to reach out, so no lead ever slips through the cracks.' },
    { iconType: 'video', title: 'WhatsApp & Email Broadcast', desc: 'Send bulk WhatsApp messages and email campaigns directly from your CRM dashboard. Reach thousands of leads with personalized messages in a single click.' },
    { iconType: 'shield', title: 'Lead Scoring & Qualification', desc: 'Automatically score and qualify leads based on custom fields and activity. Focus your team\'s energy on the hottest prospects first.' },
    { iconType: 'users', title: 'Team Collaboration & Chat', desc: 'Built-in team chat, lead assignment, role-based permissions, and a shared dashboard keep your entire sales team aligned and productive.' },
    { iconType: 'chart', title: 'Sales Analytics & Revenue Forecast', desc: 'Get real-time insights with detailed analytics dashboards. Track conversion rates, revenue forecasts, agent performance, and win/loss analysis at a glance.' },
  ];

  return (
    <section id="learn" style={{ paddingBottom: 55 }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px' }}>
        <SectionHeader pill="CRM FEATURES" title="EVERYTHING YOU NEED TO CLOSE DEALS" desc="All your sales tools in one powerful CRM platform." />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} className="curriculum-list">
          {items.map((item, i) => (
            <div
              key={i}
              style={{
                background: '#FFFFFF',
                border: '1px solid rgba(234, 179, 8, 0.35)',
                borderRadius: 14,
                padding: '16px 14px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                transition: 'all 0.2s ease',
                boxShadow: '0 3px 10px rgba(0, 0, 0, 0.02)',
              }}
              className="curriculum-card"
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  background: '#DCFCE7',
                  border: '1px solid rgba(22, 163, 74, 0.3)',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#16A34A',
                  flexShrink: 0,
                }}
                className="card-icon"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <CurriculumIconSvg type={item.iconType} />
                </svg>
              </div>
              <div style={{ flex: 1 }} className="card-body">
                <h4 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.98rem', marginBottom: 3, fontWeight: 800, color: '#0F172A' }}>{item.title}</h4>
                <p style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.45 }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===================== Curriculum Icon Helper =====================
function CurriculumIconSvg({ type }: { type: string }) {
  const icons: Record<string, React.ReactNode> = {
    bot: (
      <>
        <rect x="3" y="11" width="18" height="10" rx="2" />
        <circle cx="12" cy="5" r="2" />
        <path d="M12 7v4" />
      </>
    ),
    zap: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
    video: (
      <>
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </>
    ),
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
    users: (
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    graduation: (
      <>
        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
        <path d="M6 12v5c3 3 9 3 12 0v-5" />
      </>
    ),
    chart: (
      <>
        <path d="M3 3v18h18" />
        <path d="M7 14l4-4 3 3 5-6" />
      </>
    ),
  };
  return <>{icons[type] || icons.bot}</>;
}

// ===================== Testimonials Section =====================
function Testimonials() {
  const reviews = [
    { text: "LeadFlow CRM transformed our sales process. We went from losing track of leads to closing 40% more deals in just two months. The pipeline view is a game changer!", name: 'Vikram Sharma', location: 'Delhi', initials: 'VS', rating: 5 },
    { text: "The WhatsApp broadcast feature alone saves us 10 hours every week. We can reach all our leads with personalized messages in one click. Best CRM we've used.", name: 'Ananya Patel', location: 'Mumbai', initials: 'AP', rating: 5 },
    { text: "Automated follow-ups mean no lead ever falls through the cracks. Our team's response time dropped from days to minutes. Highly recommend LeadFlow CRM!", name: 'Rajesh Kumar', location: 'Bengaluru', initials: 'RK', rating: 5 },
    { text: "We switched from Salesforce to LeadFlow and never looked back. Setup took 5 minutes instead of 2 weeks. Our team actually uses it because it's so simple.", name: 'Priya Reddy', location: 'Hyderabad', initials: 'PR', rating: 5 },
    { text: "The lead scoring feature is incredible. We know exactly which prospects to prioritize and our conversion rate jumped from 12% to 28% in three months.", name: 'Arjun Mehta', location: 'Ahmedabad', initials: 'AM', rating: 5 },
    { text: "As a real estate agency with 200+ leads per month, LeadFlow's pipeline board keeps everything organized. The WhatsApp integration is perfect for the Indian market.", name: 'Sneha Agarwal', location: 'Kolkata', initials: 'SA', rating: 5 },
    { text: "The automation builder saved us from hiring 2 extra sales reps. Follow-up sequences run on autopilot and our team focuses only on hot leads now.", name: 'Karan Singh', location: 'Jaipur', initials: 'KS', rating: 4 },
    { text: "I run a small insurance team and was hesitant about the price. Within the first month, the email broadcast feature alone brought us 15 new clients. Worth every rupee.", name: 'Deepika Nair', location: 'Kochi', initials: 'DN', rating: 5 },
    { text: "The Google Sheets sync is a lifesaver. Our marketing team updates lead sources in Sheets and they appear in the CRM instantly. No more manual data entry.", name: 'Rohit Verma', location: 'Lucknow', initials: 'RV', rating: 5 },
  ];

  return (
    <section id="testimonials" style={{ paddingBottom: 55 }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px' }}>
        <SectionHeader pill="CUSTOMER REVIEWS" title={<>WHAT OUR <span className="text-gold-gradient">CLIENTS SAY</span></>} desc="Join 5,000+ businesses growing with LeadFlow CRM. Real reviews from real customers." />

        {/* Overall rating badge */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '10px 18px', background: '#FFFFFF', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 9999, boxShadow: '0 3px 12px rgba(234,179,8,0.06)' }}>
            <div style={{ display: 'flex', gap: 2, color: '#EAB308', fontSize: '0.9rem' }}>&#9733;&#9733;&#9733;&#9733;&#9733;</div>
            <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.88rem', fontWeight: 900, color: '#0F172A' }}>4.8/5</span>
            <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>from 500+ verified reviews</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }} className="testimonials-grid">
          {reviews.map((r, i) => (
            <div
              key={i}
              style={{
                background: '#FFFFFF',
                border: '1px solid rgba(0, 0, 0, 0.08)',
                borderRadius: 14,
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                boxShadow: '0 3px 12px rgba(0, 0, 0, 0.02)',
                transition: 'all 0.25s ease',
              }}
              className="testimonial-card"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ color: '#EAB308', fontSize: '0.85rem', display: 'flex', gap: 3 }}>
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <span key={idx} style={{ color: idx < r.rating ? '#EAB308' : '#D1D5DB' }}>&#9733;</span>
                  ))}
                </div>
                <span style={{ fontSize: '0.62rem', color: '#15803D', background: 'rgba(22, 163, 74, 0.1)', padding: '2px 7px', borderRadius: '9999px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                  Verified
                </span>
              </div>
              <p style={{ fontSize: '0.84rem', color: '#0F172A', lineHeight: 1.5, fontStyle: 'italic' }}>"{r.text}"</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto', paddingTop: 6, borderTop: '1px solid rgba(0, 0, 0, 0.06)' }} className="testimonial-user">
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #FEF08A 0%, #EAB308 50%, #CA8A04 100%)',
                    color: '#000',
                    fontWeight: 900,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.8rem',
                    flexShrink: 0,
                  }}
                >
                  {r.initials}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0F172A' }}>{r.name}</span>
                  <span style={{ fontSize: '0.7rem', color: '#475569' }}>{r.location}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA below testimonials */}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <a href="#signup" onClick={(e) => { e.preventDefault(); window.location.hash = 'signup'; }} className="gold-cta" style={{ maxWidth: 'fit-content', padding: '11px 24px', fontSize: '0.82rem', margin: '0 auto' }}>
            <span>JOIN 5,000+ BUSINESSES</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
          </a>
        </div>
      </div>
    </section>
  );
}

// ===================== Pricing Section =====================
function Pricing() {
  const telegramLink = useTelegramLink();
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');

  const plans = [
    {
      name: 'Starter',
      tagline: 'For small sales teams getting started',
      priceMonthly: 999,
      priceYearly: 799,
      icon: 'bot' as const,
      features: [
        'Up to 5 team members',
        'Lead pipeline & Kanban board',
        'Automated follow-up reminders',
        'WhatsApp broadcast (1 number)',
        'Email broadcast (1,000/mo)',
        'Basic sales analytics',
        'Popup form builder',
        'Email support',
      ],
      popular: false,
    },
    {
      name: 'Professional',
      tagline: 'For growing teams that need more power',
      priceMonthly: 2499,
      priceYearly: 1999,
      icon: 'zap' as const,
      features: [
        'Unlimited team members',
        'Everything in Starter, plus:',
        'Unlimited WhatsApp numbers',
        'Email broadcast (50,000/mo)',
        'Advanced analytics & revenue forecast',
        'Lead scoring & custom fields',
        'Automation builder',
        'Google Sheets sync',
        'Priority support',
      ],
      popular: true,
    },
    {
      name: 'Enterprise',
      tagline: 'For large teams with custom needs',
      priceMonthly: 4999,
      priceYearly: 3999,
      icon: 'shield' as const,
      features: [
        'Everything in Professional, plus:',
        'Unlimited email broadcasts',
        'Meta Ads & Conversion API',
        'Campaign optimizer',
        'Super admin dashboard',
        'Custom integrations & webhooks',
        'Dedicated account manager',
        '24/7 phone & chat support',
      ],
      popular: false,
    },
  ];

  return (
    <section id="pricing" style={{ paddingBottom: 55 }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px' }}>
        <SectionHeader pill="PRICING PLANS" title={<>CHOOSE YOUR <span className="text-gold-gradient">CRM PLAN</span></>} desc="Start with a 14-day free trial. No credit card required. Cancel anytime." />

        {/* Billing toggle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <div
            style={{
              display: 'inline-flex',
              background: '#FFFFFF',
              border: '1.5px solid rgba(234, 179, 8, 0.4)',
              borderRadius: 9999,
              padding: 4,
              boxShadow: '0 2px 8px rgba(234, 179, 8, 0.08)',
            }}
          >
            <button
              onClick={() => setBilling('monthly')}
              style={{
                padding: '7px 18px',
                borderRadius: 9999,
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'Outfit, sans-serif',
                fontWeight: 800,
                fontSize: '0.78rem',
                transition: 'all 0.2s ease',
                background: billing === 'monthly' ? 'linear-gradient(135deg, #FEF08A 0%, #EAB308 100%)' : 'transparent',
                color: billing === 'monthly' ? '#422006' : '#64748B',
              }}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling('yearly')}
              style={{
                padding: '7px 18px',
                borderRadius: 9999,
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'Outfit, sans-serif',
                fontWeight: 800,
                fontSize: '0.78rem',
                transition: 'all 0.2s ease',
                background: billing === 'yearly' ? 'linear-gradient(135deg, #FEF08A 0%, #EAB308 100%)' : 'transparent',
                color: billing === 'yearly' ? '#422006' : '#64748B',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              Yearly
              <span
                style={{
                  background: 'rgba(22, 163, 74, 0.15)',
                  color: '#15803D',
                  fontSize: '0.62rem',
                  fontWeight: 900,
                  padding: '1px 6px',
                  borderRadius: 9999,
                  border: '1px solid rgba(22, 163, 74, 0.3)',
                }}
              >
                SAVE 20%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }} className="pricing-grid">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`pricing-card ${plan.popular ? 'popular' : ''}`}
              style={{
                background: plan.popular ? '#FFFDF5' : '#FFFFFF',
                border: plan.popular ? '2px solid #EAB308' : '1px solid rgba(0, 0, 0, 0.08)',
                borderRadius: 18,
                padding: '24px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                position: 'relative',
                boxShadow: plan.popular ? '0 10px 30px rgba(234, 179, 8, 0.15)' : '0 3px 12px rgba(0, 0, 0, 0.03)',
                transition: 'all 0.25s ease',
              }}
            >
              {plan.popular && (
                <div
                  style={{
                    position: 'absolute',
                    top: -11,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'linear-gradient(135deg, #FEF08A 0%, #EAB308 50%, #CA8A04 100%)',
                    color: '#000',
                    fontWeight: 900,
                    fontSize: '0.68rem',
                    padding: '4px 14px',
                    borderRadius: 9999,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    boxShadow: '0 3px 10px rgba(234, 179, 8, 0.4)',
                    border: '1px solid #CA8A04',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Most Popular
                </div>
              )}

              {/* Plan header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    background: plan.popular ? 'linear-gradient(135deg, #FEF08A, #EAB308)' : '#F1F5F9',
                    border: plan.popular ? '1px solid #EAB308' : '1px solid rgba(0, 0, 0, 0.08)',
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: plan.popular ? '#422006' : '#64748B',
                    flexShrink: 0,
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <PricingIconSvg type={plan.icon} />
                  </svg>
                </div>
                <div>
                  <h4 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.1rem', fontWeight: 900, color: '#0F172A', marginBottom: 1 }}>{plan.name}</h4>
                  <p style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 500 }}>{plan.tagline}</p>
                </div>
              </div>

              {/* Price */}
              <div style={{ textAlign: 'center', padding: '6px 0 2px 0' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 2 }}>
                  <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem', fontWeight: 800, color: '#64748B', marginTop: 6 }}>{'\u20B9'}</span>
                  <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '2.4rem', fontWeight: 900, color: plan.popular ? '#CA8A04' : '#0F172A', lineHeight: 1 }}>
                    {billing === 'monthly' ? plan.priceMonthly.toLocaleString('en-IN') : plan.priceYearly.toLocaleString('en-IN')}
                  </span>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 600, marginTop: 2 }}>
                  per month {billing === 'yearly' && '\u00b7 billed annually'}
                </div>
              </div>

              {/* CTA */}
              <a
                href="#signup"
                onClick={(event) => { event.preventDefault(); window.location.hash = 'signup'; }}
                className={plan.popular ? 'gold-cta' : 'pricing-cta-secondary'}
                style={{
                  margin: '0 auto',
                  width: '100%',
                  maxWidth: 260,
                  ...(plan.popular ? {} : {
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 7,
                    padding: '10px 18px',
                    borderRadius: 10,
                    background: '#F8FAFC',
                    border: '1.5px solid rgba(234, 179, 8, 0.4)',
                    color: '#422006',
                    fontFamily: 'Outfit, sans-serif',
                    fontWeight: 800,
                    fontSize: '0.8rem',
                    textDecoration: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }),
                }}
              >
                {plan.name === 'Enterprise' ? 'Contact Sales' : 'Start Free Trial'}
              </a>

              {/* Features */}
              <div style={{ borderTop: '1px solid rgba(0, 0, 0, 0.06)', paddingTop: 12 }}>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {plan.features.map((f, i) => {
                    const isHeader = f.endsWith('plus:');
                    return (
                      <li
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 8,
                          fontSize: '0.78rem',
                          color: isHeader ? '#0F172A' : '#475569',
                          fontWeight: isHeader ? 800 : 500,
                          lineHeight: 1.4,
                        }}
                      >
                        {!isHeader && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: '#16A34A', flexShrink: 0, marginTop: 2 }}>
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                        <span style={isHeader ? { fontWeight: 800, paddingTop: 2 } : {}}>{f}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom note */}
        <p style={{ textAlign: 'center', fontSize: '0.76rem', color: '#94A3B8', marginTop: 18, fontWeight: 500 }}>
          All plans include a 14-day free trial &bull; No credit card required &bull; Cancel anytime
        </p>
      </div>
    </section>
  );
}

function PricingIconSvg({ type }: { type: string }) {
  const icons: Record<string, React.ReactNode> = {
    bot: (
      <>
        <rect x="3" y="11" width="18" height="10" rx="2" />
        <circle cx="12" cy="5" r="2" />
        <path d="M12 7v4" />
      </>
    ),
    zap: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  };
  return <>{icons[type] || icons.bot}</>;
}

// ===================== FAQ Section =====================
function FAQ() {
  const categories = [
    { id: 'general', label: 'General' },
    { id: 'features', label: 'Features' },
    { id: 'pricing', label: 'Pricing & Trial' },
    { id: 'security', label: 'Security & Data' },
  ];
  const faqs = [
    { cat: 'general', q: 'What makes LeadFlow CRM different from other CRMs?', a: 'LeadFlow CRM is built specifically for sales teams that manage leads across WhatsApp, Email, and phone. Unlike generic CRMs, it combines lead pipeline management, automated follow-ups, WhatsApp & Email broadcasts, and team collaboration in one simple dashboard.' },
    { cat: 'general', q: 'How does the 14-day free trial work?', a: 'Just sign up with your details — no credit card required. You get full access to all CRM features for 14 days. No hidden charges, no auto-charges. You decide if you want to continue after the trial.' },
    { cat: 'general', q: 'How long does setup take?', a: 'Most teams are up and running in under 5 minutes. Import your leads via CSV or Google Sheets, connect your WhatsApp number, and your pipeline is ready. No technical knowledge required.' },
    { cat: 'features', q: 'Can I import my existing leads into the CRM?', a: 'Yes! You can bulk import leads via CSV upload, connect Google Sheets for auto-sync, or capture leads directly from your website using customizable popup forms. Everything is ready in minutes.' },
    { cat: 'features', q: 'Does it support WhatsApp bulk messaging?', a: 'Absolutely. Connect your WhatsApp Business number and send personalized bulk messages to thousands of leads in one click. Track delivery, read receipts, and replies — all from the CRM dashboard.' },
    { cat: 'features', q: 'Can I assign leads to different team members?', a: 'Yes. LeadFlow supports round-robin auto-assignment, manual assignment, and role-based permissions. Each team member sees only their leads and can collaborate via built-in team chat.' },
    { cat: 'features', q: 'What integrations are available?', a: 'LeadFlow integrates with WhatsApp, Email SMTP, Google Sheets, Meta Ads, Telegram, Twilio for calling, and webhooks. You can also use our API for custom integrations.' },
    { cat: 'pricing', q: 'Do I need a credit card to start the trial?', a: 'No. The 14-day free trial requires no credit card. You only provide payment when you choose a paid plan after the trial ends.' },
    { cat: 'pricing', q: 'Can I change or cancel my plan anytime?', a: 'Yes. You can upgrade, downgrade, or cancel your subscription at any time from the CRM settings. No lock-in contracts or cancellation fees.' },
    { cat: 'pricing', q: 'Is there a discount for annual billing?', a: 'Yes! Annual billing saves you 20% compared to monthly billing. You can switch between monthly and yearly at any time.' },
    { cat: 'security', q: 'Is my lead data secure?', a: 'Absolutely. All data is encrypted and stored securely with enterprise-grade security. We never share or sell your data. Regular backups ensure your business information is always safe.' },
    { cat: 'security', q: 'Who owns my data?', a: 'You do. Your lead data belongs to you 100%. You can export it anytime and delete your account permanently from the settings. We never use your data for advertising or share it with third parties.' },
    { cat: 'security', q: 'What happens to my data if I cancel?', a: 'You can export all your data before cancellation. After account deletion, your data is permanently removed from our servers within 30 days.' },
  ];
  const [activeCat, setActiveCat] = useState('general');
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const filtered = faqs.filter((f) => f.cat === activeCat);

  return (
    <section id="faq" style={{ paddingBottom: 55 }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px' }}>
        <SectionHeader pill="QUESTIONS & ANSWERS" title={<>FREQUENTLY ASKED <span className="text-gold-gradient">QUESTIONS</span></>} desc="Everything you need to know about LeadFlow CRM." />

        {/* Category tabs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => { setActiveCat(c.id); setOpenIdx(0); }}
              style={{
                padding: '7px 16px',
                borderRadius: 9999,
                border: activeCat === c.id ? '1.5px solid #EAB308' : '1px solid rgba(0,0,0,0.1)',
                background: activeCat === c.id ? 'linear-gradient(135deg, #FEF08A, #EAB308)' : '#FFFFFF',
                color: activeCat === c.id ? '#422006' : '#475569',
                fontFamily: 'Outfit, sans-serif',
                fontWeight: 800,
                fontSize: '0.76rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 720, margin: '0 auto' }}>
          {filtered.map((faq, i) => (
            <div
              key={i}
              className={`faq-item ${openIdx === i ? 'active' : ''}`}
              style={{
                background: '#FFFFFF',
                border: '1px solid rgba(0, 0, 0, 0.08)',
                borderRadius: 14,
                overflow: 'hidden',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 5px rgba(0, 0, 0, 0.02)',
              }}
            >
              <div
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                style={{
                  padding: '14px 16px',
                  fontSize: '0.9rem',
                  fontWeight: 800,
                  color: '#0F172A',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  userSelect: 'none',
                }}
                className="faq-question"
              >
                <span>{faq.q}</span>
                <svg className="faq-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: '#CA8A04', flexShrink: 0 }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
              <div className="faq-answer">{faq.a}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===================== Product Screenshot Carousel =====================
function ProductCarousel() {
  const slides = [
    {
      title: 'Lead Pipeline Dashboard',
      desc: 'Drag-and-drop leads through every sales stage. Assign team members and never lose track of a deal.',
      accent: '#EAB308',
      mockup: 'pipeline' as const,
    },
    {
      title: 'WhatsApp & Email Broadcast',
      desc: 'Send bulk personalized messages to thousands of leads in one click. Track delivery and responses.',
      accent: '#16A34A',
      mockup: 'broadcast' as const,
    },
    {
      title: 'Analytics & Revenue Forecast',
      desc: 'Real-time conversion rates, agent performance, and revenue projections at a glance.',
      accent: '#0EA5E9',
      mockup: 'analytics' as const,
    },
    {
      title: 'Automation Builder',
      desc: 'Set up automatic follow-ups, lead scoring, and drip campaigns without writing a single line of code.',
      accent: '#A855F7',
      mockup: 'automation' as const,
    },
  ];
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [paused, slides.length]);

  return (
    <section id="product" style={{ paddingBottom: 55 }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px' }}>
        <SectionHeader pill="PRODUCT TOUR" title={<>SEE THE <span className="text-gold-gradient">CRM IN ACTION</span></>} desc="Get a glimpse of what awaits you inside LeadFlow CRM." />
        <div
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          style={{
            background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
            borderRadius: 20,
            overflow: 'hidden',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.2)',
            border: '1px solid rgba(234, 179, 8, 0.2)',
          }}
        >
          {/* Window chrome */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#EF4444' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#F59E0B' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#22C55E' }} />
            <div style={{ flex: 1, textAlign: 'center', fontSize: '0.72rem', color: '#94A3B8', fontWeight: 600 }}>app.leadflowcrm.com</div>
          </div>

          {/* Slide content */}
          <div style={{ position: 'relative', minHeight: 320 }} className="carousel-stage">
            {slides.map((slide, i) => (
              <div
                key={i}
                style={{
                  display: i === current ? 'block' : 'none',
                  padding: '28px 20px',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="carousel-slide-grid">
                  <div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderRadius: 9999, background: `${slide.accent}20`, border: `1px solid ${slide.accent}40`, marginBottom: 12 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: slide.accent }} />
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: slide.accent, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Feature {i + 1} of {slides.length}</span>
                    </div>
                    <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.4rem', fontWeight: 900, color: '#F1F5F9', marginBottom: 8, lineHeight: 1.3 }}>{slide.title}</h3>
                    <p style={{ fontSize: '0.85rem', color: '#94A3B8', lineHeight: 1.55, maxWidth: 400 }}>{slide.desc}</p>
                  </div>
                  <ProductMockup type={slide.mockup} accent={slide.accent} />
                </div>
              </div>
            ))}
          </div>

          {/* Dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '0 0 20px 0' }}>
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                aria-label={`Go to slide ${i + 1}`}
                style={{
                  width: i === current ? 28 : 8,
                  height: 8,
                  borderRadius: 9999,
                  border: 'none',
                  cursor: 'pointer',
                  background: i === current ? 'var(--landing-primary, #EAB308)' : 'rgba(255, 255, 255, 0.25)',
                  transition: 'all 0.3s ease',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductMockup({ type, accent }: { type: 'pipeline' | 'broadcast' | 'analytics' | 'automation'; accent: string }) {
  if (type === 'pipeline') {
    const stages = [
      { name: 'New', count: 12, color: '#3B82F6' },
      { name: 'Contacted', count: 8, color: '#F59E0B' },
      { name: 'Qualified', count: 5, color: '#A855F7' },
      { name: 'Won', count: 3, color: '#22C55E' },
    ];
    return (
      <div style={{ background: '#1E293B', borderRadius: 12, padding: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }} className="pipeline-mockup-grid">
          {stages.map((s) => (
            <div key={s.name} style={{ background: '#0F172A', borderRadius: 8, padding: 10, border: `1px solid ${s.color}30` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: s.color }}>{s.name}</span>
                <span style={{ fontSize: '0.62rem', color: '#64748B', background: '#1E293B', padding: '1px 6px', borderRadius: 9999 }}>{s.count}</span>
              </div>
              {Array.from({ length: Math.min(s.count, 3) }).map((_, idx) => (
                <div key={idx} style={{ background: '#1E293B', borderRadius: 6, padding: '7px 8px', marginBottom: 5, border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ height: 5, width: '70%', background: '#334155', borderRadius: 3, marginBottom: 4 }} />
                  <div style={{ height: 4, width: '50%', background: '#1E293B', borderRadius: 3 }} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (type === 'broadcast') {
    return (
      <div style={{ background: '#1E293B', borderRadius: 12, padding: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <span style={{ padding: '5px 12px', borderRadius: 8, background: '#22C55E20', border: '1px solid #22C55E40', fontSize: '0.72rem', fontWeight: 700, color: '#22C55E' }}>WhatsApp</span>
          <span style={{ padding: '5px 12px', borderRadius: 8, background: '#0EA5E920', border: '1px solid #0EA5E940', fontSize: '0.72rem', fontWeight: 700, color: '#0EA5E9' }}>Email</span>
        </div>
        <div style={{ background: '#0F172A', borderRadius: 8, padding: 12, marginBottom: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginBottom: 6 }}>To: 2,847 leads</div>
          <div style={{ height: 5, width: '90%', background: '#334155', borderRadius: 3, marginBottom: 4 }} />
          <div style={{ height: 5, width: '75%', background: '#334155', borderRadius: 3, marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 12, fontSize: '0.68rem' }}>
            <span style={{ color: '#22C55E' }}>Delivered: 2,710</span>
            <span style={{ color: '#F59E0B' }}>Read: 1,842</span>
            <span style={{ color: '#A855F7' }}>Replied: 318</span>
          </div>
        </div>
        <div style={{ height: 6, background: '#1E293B', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: '72%', background: 'linear-gradient(90deg, #22C55E, #16A34A)', borderRadius: 3 }} />
        </div>
      </div>
    );
  }
  if (type === 'analytics') {
    const bars = [40, 65, 50, 80, 55, 90, 70];
    return (
      <div style={{ background: '#1E293B', borderRadius: 12, padding: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: '0.68rem', color: '#64748B' }}>Revenue This Month</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#F1F5F9' }}>{'\u20B9'}4.2L</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.68rem', color: '#64748B' }}>Conversion</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#22C55E' }}>34%</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80, marginBottom: 8 }}>
          {bars.map((h, i) => (
            <div key={i} style={{ flex: 1, height: `${h}%`, background: `linear-gradient(180deg, ${accent}, ${accent}60)`, borderRadius: '4px 4px 0 0', opacity: i === 5 ? 1 : 0.6 }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: '#64748B' }}>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <span key={d}>{d}</span>)}
        </div>
      </div>
    );
  }
  return (
    <div style={{ background: '#1E293B', borderRadius: 12, padding: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { trigger: 'New lead arrives', action: 'Assign to round-robin agent', icon: 'zap' },
          { trigger: 'No response in 24h', action: 'Auto-send WhatsApp follow-up', icon: 'clock' },
          { trigger: 'Lead scores 80+', action: 'Move to Hot Leads & notify manager', icon: 'flame' },
        ].map((step, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#0F172A', borderRadius: 8, padding: '10px 12px', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${accent}20`, border: `1px solid ${accent}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2">
                {step.icon === 'zap' && <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />}
                {step.icon === 'clock' && <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>}
                {step.icon === 'flame' && <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />}
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94A3B8' }}>{step.trigger}</div>
              <div style={{ fontSize: '0.76rem', fontWeight: 600, color: '#F1F5F9' }}>{'\u2192'} {step.action}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===================== How It Works =====================
function HowItWorks() {
  const steps = [
    { num: '1', title: 'Sign Up & Import Leads', desc: 'Create your free account and import leads via CSV, Google Sheets, or connect your website popup forms. Setup takes under 5 minutes.', icon: 'signup', color: '#EAB308' },
    { num: '2', title: 'Automate Your Pipeline', desc: 'Set up follow-up schedules, lead scoring, and WhatsApp/email automations. Assign leads to team members automatically.', icon: 'automate', color: '#16A34A' },
    { num: '3', title: 'Close More Deals', desc: 'Track every lead through your pipeline, monitor team performance with real-time analytics, and watch your close rate soar.', icon: 'close', color: '#0EA5E9' },
  ];
  return (
    <section id="how-it-works" style={{ paddingBottom: 55 }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px' }}>
        <SectionHeader pill="GET STARTED FAST" title={<>HOW IT <span className="text-gold-gradient">WORKS</span></>} desc="From signup to closing deals in 3 simple steps." />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, position: 'relative' }} className="how-it-works-list">
          {steps.map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 16, position: 'relative', paddingBottom: i < steps.length - 1 ? 32 : 0 }}>
              {i < steps.length - 1 && (
                <div style={{ position: 'absolute', left: 27, top: 56, bottom: 0, width: 2, background: 'linear-gradient(180deg, rgba(234, 179, 8, 0.3), rgba(234, 179, 8, 0.05))' }} />
              )}
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FFFFFF', border: `2px solid ${step.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 4px 14px ${step.color}20` }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={step.color} strokeWidth="2">
                  {step.icon === 'signup' && <><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></>}
                  {step.icon === 'automate' && <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>}
                  {step.icon === 'close' && <><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" /><polyline points="15 7 20 7 20 12" /></>}
                </svg>
              </div>
              <div style={{ flex: 1, paddingTop: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.7rem', fontWeight: 900, color: step.color, background: `${step.color}15`, padding: '2px 8px', borderRadius: 9999 }}>STEP {step.num}</span>
                </div>
                <h4 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.1rem', fontWeight: 900, color: '#0F172A', marginBottom: 5 }}>{step.title}</h4>
                <p style={{ fontSize: '0.84rem', color: '#475569', lineHeight: 1.5 }}>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <a href="#signup" onClick={(e) => { e.preventDefault(); window.location.hash = 'signup'; }} className="gold-cta">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
            <span>GET STARTED FREE</span>
          </a>
        </div>
      </div>
    </section>
  );
}

// ===================== Comparison Table =====================
function ComparisonTable() {
  const features = [
    { label: 'Lead Pipeline & Kanban Board', leadflow: true, basic: true, manual: false },
    { label: 'Automated Follow-up Reminders', leadflow: true, basic: false, manual: false },
    { label: 'WhatsApp Bulk Broadcast', leadflow: true, basic: false, manual: false },
    { label: 'Email Broadcast Campaigns', leadflow: true, basic: true, manual: false },
    { label: 'Team Chat & Collaboration', leadflow: true, basic: false, manual: false },
    { label: 'Lead Scoring & Qualification', leadflow: true, basic: false, manual: false },
    { label: 'Revenue Forecast Analytics', leadflow: true, basic: false, manual: false },
    { label: 'Automation Builder', leadflow: true, basic: false, manual: false },
    { label: 'Google Sheets Sync', leadflow: true, basic: false, manual: false },
    { label: 'Popup Form Builder', leadflow: true, basic: true, manual: false },
    { label: 'Meta Ads Integration', leadflow: true, basic: false, manual: false },
    { label: 'No-Code Setup (Under 5 min)', leadflow: true, basic: false, manual: false },
  ];
  return (
    <section id="comparison" style={{ paddingBottom: 55 }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px' }}>
        <SectionHeader pill="WHY LEADFLOW" title={<>LEADFLOW CRM vs <span className="text-gold-gradient">THE REST</span></>} desc="See why thousands of teams switch from spreadsheets and generic CRMs to LeadFlow." />
        <div style={{ background: '#FFFFFF', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }} className="comparison-table-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                <th style={{ textAlign: 'left', padding: '14px 16px', fontWeight: 800, color: '#0F172A', fontSize: '0.78rem' }}>Feature</th>
                <th style={{ padding: '14px 12px', textAlign: 'center', fontWeight: 900, fontSize: '0.82rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                    <span style={{ color: '#CA8A04' }}>LeadFlow CRM</span>
                    <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#22C55E', background: 'rgba(34, 197, 94, 0.1)', padding: '1px 8px', borderRadius: 9999 }}>RECOMMENDED</span>
                  </div>
                </th>
                <th style={{ padding: '14px 12px', textAlign: 'center', fontWeight: 800, color: '#64748B', fontSize: '0.78rem' }} className="hide-mobile">Generic CRMs</th>
                <th style={{ padding: '14px 12px', textAlign: 'center', fontWeight: 800, color: '#64748B', fontSize: '0.78rem' }} className="hide-mobile">Spreadsheets</th>
              </tr>
            </thead>
            <tbody>
              {features.map((f, i) => (
                <tr key={i} style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                  <td style={{ padding: '11px 16px', fontWeight: 600, color: '#0F172A', fontSize: '0.8rem' }}>{f.label}</td>
                  <td style={{ padding: '11px 12px', textAlign: 'center', background: 'rgba(234, 179, 8, 0.04)' }}>
                    {f.leadflow ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="3" style={{ display: 'inline-block' }}><polyline points="20 6 9 17 4 12" /></svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="3" style={{ display: 'inline-block' }}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    )}
                  </td>
                  <td style={{ padding: '11px 12px', textAlign: 'center' }} className="hide-mobile">
                    {f.basic ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="3" style={{ display: 'inline-block' }}><polyline points="20 6 9 17 4 12" /></svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="3" style={{ display: 'inline-block' }}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    )}
                  </td>
                  <td style={{ padding: '11px 12px', textAlign: 'center' }} className="hide-mobile">
                    {f.manual ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="3" style={{ display: 'inline-block' }}><polyline points="20 6 9 17 4 12" /></svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="3" style={{ display: 'inline-block' }}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    )}
                  </td>
                </tr>
              ))}
              <tr style={{ background: '#FFFDF5', borderTop: '2px solid rgba(234, 179, 8, 0.3)' }}>
                <td style={{ padding: '12px 16px', fontWeight: 900, color: '#0F172A', fontSize: '0.82rem' }}>Price Starting At</td>
                <td style={{ padding: '12px 12px', textAlign: 'center', fontWeight: 900, color: '#CA8A04', fontSize: '0.88rem' }}>{'\u20B9'}799/mo</td>
                <td style={{ padding: '12px 12px', textAlign: 'center', fontWeight: 700, color: '#64748B', fontSize: '0.82rem' }} className="hide-mobile">{'\u20B9'}2,000+/mo</td>
                <td style={{ padding: '12px 12px', textAlign: 'center', fontWeight: 700, color: '#64748B', fontSize: '0.82rem' }} className="hide-mobile">Free*</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p style={{ textAlign: 'center', fontSize: '0.72rem', color: '#94A3B8', marginTop: 10 }}>*Spreadsheets cost you in lost deals and hours of manual work. LeadFlow pays for itself.</p>
      </div>
    </section>
  );
}

// ===================== Integrations Strip =====================
function IntegrationsStrip() {
  const integrations = [
    { name: 'WhatsApp', color: '#25D366', icon: 'whatsapp' },
    { name: 'Email SMTP', color: '#0EA5E9', icon: 'mail' },
    { name: 'Google Sheets', color: '#22C55E', icon: 'sheets' },
    { name: 'Meta Ads', color: '#1877F2', icon: 'meta' },
    { name: 'Telegram', color: '#2AABEE', icon: 'telegram' },
    { name: 'Twilio Calls', color: '#F22F46', icon: 'phone' },
    { name: 'Webhooks', color: '#8B5CF6', icon: 'webhook' },
    { name: 'CSV Import', color: '#F59E0B', icon: 'csv' },
  ];
  return (
    <section style={{ paddingBottom: 40 }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px' }}>
        <p style={{ textAlign: 'center', fontSize: '0.78rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 18 }}>
          Works With Your Favorite Tools
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }} className="integrations-strip">
          {integrations.map((int) => (
            <div
              key={int.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: '#FFFFFF',
                border: '1px solid rgba(0, 0, 0, 0.06)',
                borderRadius: 10,
                padding: '8px 14px',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.02)',
                transition: 'all 0.2s ease',
                cursor: 'default',
              }}
              className="integration-chip"
            >
              <div style={{ width: 24, height: 24, borderRadius: 6, background: `${int.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={int.color} strokeWidth="2">
                  {int.icon === 'whatsapp' && <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />}
                  {int.icon === 'mail' && <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 5L2 7" /></>}
                  {int.icon === 'sheets' && <><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" /><line x1="9" y1="3" x2="9" y2="21" /></>}
                  {int.icon === 'meta' && <circle cx="12" cy="12" r="10" />}
                  {int.icon === 'telegram' && <path d="m22 2-7 20-4-9-9-4Z" />}
                  {int.icon === 'phone' && <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />}
                  {int.icon === 'webhook' && <path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.94.46-1.83 1.21-2.4.76-.57 1.72-.8 2.65-.6 1.17.26 2.14 1.13 2.14 1.13" />}
                  {int.icon === 'csv' && <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" /></>}
                </svg>
              </div>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0F172A' }}>{int.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===================== Video Testimonials =====================
function VideoTestimonials() {
  const testimonials = [
    { name: 'Vikram Sharma', company: 'Sharma Real Estate', location: 'Delhi', quote: 'We went from losing track of leads to closing 40% more deals in 2 months.', result: '+40% Close Rate', color: '#EAB308', initials: 'VS' },
    { name: 'Ananya Patel', company: 'Patya Fintech', location: 'Mumbai', quote: 'The WhatsApp broadcast saves us 10 hours every week. Best CRM we have used.', result: '10 hrs/week Saved', color: '#22C55E', initials: 'AP' },
    { name: 'Rajesh Kumar', company: 'Kumar Insurance', location: 'Bengaluru', quote: 'Response time dropped from days to minutes. No lead ever slips through.', result: '98% Response Rate', color: '#0EA5E9', initials: 'RK' },
    { name: 'Neha Gupta', company: 'Gupta EduTech', location: 'Pune', quote: 'Automated follow-ups and lead scoring helped us focus on the hottest prospects.', result: '3x Revenue Growth', color: '#A855F7', initials: 'NG' },
  ];
  return (
    <section id="video-testimonials" style={{ paddingBottom: 55 }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px' }}>
        <SectionHeader pill="VIDEO STORIES" title={<>REAL <span className="text-gold-gradient">RESULTS</span></>} desc="Hear from businesses transforming their sales with LeadFlow CRM." />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }} className="video-testimonials-grid">
          {testimonials.map((t, i) => (
            <div
              key={i}
              style={{
                background: '#FFFFFF',
                border: '1px solid rgba(0, 0, 0, 0.08)',
                borderRadius: 16,
                overflow: 'hidden',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)',
                transition: 'all 0.25s ease',
                display: 'flex',
                flexDirection: 'column',
              }}
              className="video-testimonial-card"
            >
              {/* Video placeholder area */}
              <div
                style={{
                  background: `linear-gradient(135deg, ${t.color}10 0%, ${t.color}25 100%)`,
                  padding: '24px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${t.color}, ${t.color}80)` }} />
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${t.color}, ${t.color}80)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    cursor: 'pointer',
                    boxShadow: `0 4px 14px ${t.color}40`,
                    transition: 'transform 0.2s ease',
                  }}
                  className="play-btn"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#FFFFFF"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0F172A' }}>{t.name}</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748B' }}>{t.company} &bull; {t.location}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8, background: `${t.color}15`, border: `1px solid ${t.color}30`, flexShrink: 0 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.color} strokeWidth="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: t.color }}>{t.result}</span>
                </div>
              </div>
              {/* Quote */}
              <div style={{ padding: '16px 18px' }}>
                <div style={{ color: '#EAB308', fontSize: '0.8rem', marginBottom: 8, display: 'flex', gap: 2 }}>&#9733;&#9733;&#9733;&#9733;&#9733;</div>
                <p style={{ fontSize: '0.85rem', color: '#0F172A', lineHeight: 1.55, fontStyle: 'italic' }}>&ldquo;{t.quote}&rdquo;</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===================== ROI Calculator =====================
function RoiCalculator() {
  const [leadsPerMonth, setLeadsPerMonth] = useState(500);
  const [closeRate, setCloseRate] = useState(15);
  const [dealSize, setDealSize] = useState(10000);

  const currentRevenue = Math.round(leadsPerMonth * (closeRate / 100) * dealSize);
  const improvedCloseRate = Math.min(closeRate + 12, 60);
  const improvedRevenue = Math.round(leadsPerMonth * (improvedCloseRate / 100) * dealSize);
  const revenueGain = improvedRevenue - currentRevenue;
  const formatINR = (n: number) => {
    if (n >= 10000000) return `${'\u20B9'}${(n / 10000000).toFixed(1)}Cr`;
    if (n >= 100000) return `${'\u20B9'}${(n / 100000).toFixed(1)}L`;
    if (n >= 1000) return `${'\u20B9'}${(n / 1000).toFixed(0)}K`;
    return `${'\u20B9'}${n}`;
  };
  return (
    <section id="roi" style={{ paddingBottom: 55 }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px' }}>
        <SectionHeader pill="ROI CALCULATOR" title={<>HOW MUCH ARE YOU <span className="text-gold-gradient">LEAVING ON THE TABLE?</span></>} desc="Enter your numbers to see the revenue you could recover with LeadFlow CRM." />
        <div style={{ background: '#FFFFFF', borderRadius: 18, border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 6px 24px rgba(0,0,0,0.04)', overflow: 'hidden' }} className="roi-calculator-wrap">
          <div style={{ display: 'flex', flexDirection: 'column' }} className="roi-grid">
            {/* Inputs */}
            <div style={{ padding: '24px 20px', background: '#F8FAFC', borderRight: '1px solid rgba(0,0,0,0.06)' }} className="roi-inputs">
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#0F172A', marginBottom: 6 }}>Monthly Leads</label>
                <input
                  type="range"
                  min={50}
                  max={5000}
                  step={50}
                  value={leadsPerMonth}
                  onChange={(e) => setLeadsPerMonth(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#EAB308' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748B', marginTop: 4 }}>
                  <span>50</span>
                  <span style={{ fontWeight: 800, color: '#CA8A04' }}>{leadsPerMonth.toLocaleString('en-IN')} leads/mo</span>
                  <span>5,000</span>
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#0F172A', marginBottom: 6 }}>Current Close Rate (%)</label>
                <input
                  type="range"
                  min={5}
                  max={50}
                  step={1}
                  value={closeRate}
                  onChange={(e) => setCloseRate(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#EAB308' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748B', marginTop: 4 }}>
                  <span>5%</span>
                  <span style={{ fontWeight: 800, color: '#CA8A04' }}>{closeRate}%</span>
                  <span>50%</span>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#0F172A', marginBottom: 6 }}>Average Deal Size ({'\u20B9'})</label>
                <input
                  type="range"
                  min={1000}
                  max={100000}
                  step={1000}
                  value={dealSize}
                  onChange={(e) => setDealSize(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#EAB308' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748B', marginTop: 4 }}>
                  <span>{'\u20B9'}1K</span>
                  <span style={{ fontWeight: 800, color: '#CA8A04' }}>{'\u20B9'}{dealSize.toLocaleString('en-IN')}</span>
                  <span>{'\u20B9'}1L</span>
                </div>
              </div>
            </div>
            {/* Results */}
            <div style={{ padding: '24px 20px' }} className="roi-results">
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Current Monthly Revenue</div>
                <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.6rem', fontWeight: 900, color: '#475569' }}>{formatINR(currentRevenue)}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: '#64748B', marginBottom: 16 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5"><path d="M7 17l4-4 3 3 5-6" /><path d="M15 7h6v6" /></svg>
                With LeadFlow CRM ({improvedCloseRate}% close rate)
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#16A34A', marginBottom: 4 }}>Projected Monthly Revenue</div>
                <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '2rem', fontWeight: 900, color: '#16A34A' }}>{formatINR(improvedRevenue)}</div>
              </div>
              <div style={{ background: 'linear-gradient(135deg, #FFFDF5, #FEF9C3)', borderRadius: 12, padding: '14px 16px', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#854D0E', marginBottom: 2 }}>Extra Revenue Per Month</div>
                <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.8rem', fontWeight: 900, color: '#CA8A04' }}>+{formatINR(revenueGain)}</div>
                <div style={{ fontSize: '0.68rem', color: '#92400E', marginTop: 2 }}>= {formatINR(revenueGain * 12)} / year</div>
              </div>
              <a href="#signup" onClick={(e) => { e.preventDefault(); window.location.hash = 'signup'; }} className="gold-cta" style={{ marginTop: 16, width: '100%', maxWidth: '100%' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
                <span>CLAIM THIS REVENUE</span>
              </a>
            </div>
          </div>
        </div>
        <p style={{ textAlign: 'center', fontSize: '0.72rem', color: '#94A3B8', marginTop: 10 }}>Estimates based on avg 12% close-rate improvement after implementing LeadFlow CRM.</p>
      </div>
    </section>
  );
}

// ===================== Live Activity Feed =====================
function LiveActivityFeed() {
  const [activities, setActivities] = useState<{ name: string; city: string; action: string; time: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc('get_public_recent_activity');
      if (data && data.length > 0) {
        const actions = ['signed up for free trial', 'imported leads into CRM', 'started WhatsApp broadcast', 'set up automated follow-ups', 'closed a deal via pipeline'];
        const mapped = (data as { full_name: string; state: string; created_at: string }[]).map((s, i: number) => ({
          name: s.full_name?.split(' ').slice(0, 2).join(' ') || 'Anonymous',
          city: s.state || 'India',
          action: actions[i % actions.length],
          time: timeAgo(s.created_at),
        }));
        setActivities(mapped);
      } else {
        setActivities([
          { name: 'Rahul S.', city: 'Delhi', action: 'signed up for free trial', time: '1 min ago' },
          { name: 'Priya K.', city: 'Jaipur', action: 'imported 200 leads', time: '3 min ago' },
          { name: 'Amit V.', city: 'Mumbai', action: 'started WhatsApp broadcast', time: '5 min ago' },
        ]);
      }
      setLoading(false);
    })();
  }, []);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <section style={{ paddingBottom: 40 }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px' }}>
        <SectionHeader pill="LIVE FEED" title={<>REAL <span className="text-gold-gradient">SIGNUPS</span></>} desc="See who is joining LeadFlow CRM right now." />
        <div style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.03)', overflow: 'hidden', maxHeight: 340, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#94A3B8', fontSize: '0.82rem' }}>Loading recent activity...</div>
          ) : (
            activities.map((a, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  borderTop: i === 0 ? 'none' : '1px solid rgba(0,0,0,0.04)',
                }}
              >
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, #FEF08A, #EAB308, #CA8A04)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 900, fontSize: '0.72rem', color: '#000' }}>
                  {a.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0F172A' }}>{a.name}</span>
                  <span style={{ fontSize: '0.78rem', color: '#475569' }}> from {a.city} {a.action}</span>
                  <div style={{ fontSize: '0.68rem', color: '#94A3B8' }}>{a.time}</div>
                </div>
                <span className="live-dot" style={{ flexShrink: 0 }} />
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

// ===================== Industry Use Cases =====================
function IndustryUseCases() {
  const industries = [
    { name: 'Real Estate', icon: 'home', color: '#0EA5E9', desc: 'Track property inquiries, schedule site visits, and close deals faster with automated follow-ups.' },
    { name: 'Insurance', icon: 'shield', color: '#16A34A', desc: 'Manage policy leads, send renewal reminders, and broadcast new offers via WhatsApp and Email.' },
    { name: 'Education', icon: 'book', color: '#A855F7', desc: 'Capture student inquiries, automate course follow-ups, and track enrollment conversions.' },
    { name: 'Fintech', icon: 'wallet', color: '#F59E0B', desc: 'Onboard clients, manage KYC pipelines, and send compliance updates in bulk.' },
    { name: 'Healthcare', icon: 'heart', color: '#EF4444', desc: 'Manage patient inquiries, appointment scheduling, and health campaign broadcasts.' },
    { name: 'Retail & D2C', icon: 'shopping', color: '#EAB308', desc: 'Capture leads from website popups, run promotional broadcasts, and track customer journeys.' },
  ];
  return (
    <section id="industries" style={{ paddingBottom: 55 }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px' }}>
        <SectionHeader pill="INDUSTRY USE CASES" title={<>BUILT FOR <span className="text-gold-gradient">YOUR INDUSTRY</span></>} desc="LeadFlow CRM adapts to how your team works — no matter what you sell." />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }} className="industry-grid">
          {industries.map((ind) => (
            <div
              key={ind.name}
              style={{
                background: '#FFFFFF',
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: 14,
                padding: '18px 16px',
                display: 'flex',
                gap: 14,
                alignItems: 'flex-start',
                transition: 'all 0.25s ease',
                boxShadow: '0 3px 10px rgba(0,0,0,0.02)',
              }}
              className="industry-card"
            >
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `${ind.color}15`, border: `1px solid ${ind.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ind.color} strokeWidth="2">
                  {ind.icon === 'home' && <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>}
                  {ind.icon === 'shield' && <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />}
                  {ind.icon === 'book' && <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>}
                  {ind.icon === 'wallet' && <><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></>}
                  {ind.icon === 'heart' && <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />}
                  {ind.icon === 'shopping' && <><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></>}
                </svg>
              </div>
              <div>
                <h4 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1rem', fontWeight: 900, color: '#0F172A', marginBottom: 4 }}>{ind.name}</h4>
                <p style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.5 }}>{ind.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===================== Before vs After LeadFlow =====================
function BeforeAfter() {
  const beforeItems = [
    { text: 'Leads scattered across Excel sheets and WhatsApp chats', icon: 'x' },
    { text: 'No follow-up tracking — deals slip through the cracks', icon: 'x' },
    { text: 'Manual WhatsApp messages one-by-one', icon: 'x' },
    { text: 'No idea which team member is working on which lead', icon: 'x' },
    { text: 'Guesswork instead of data-driven sales decisions', icon: 'x' },
  ];
  const afterItems = [
    { text: 'All leads in one visual pipeline dashboard', icon: 'check' },
    { text: 'Automatic follow-up reminders — never miss a deal', icon: 'check' },
    { text: 'Bulk WhatsApp & Email broadcasts in one click', icon: 'check' },
    { text: 'Clear lead assignment and team performance tracking', icon: 'check' },
    { text: 'Real-time analytics, revenue forecast, and conversion rates', icon: 'check' },
  ];
  return (
    <section style={{ paddingBottom: 55 }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px' }}>
        <SectionHeader pill="THE TRANSFORMATION" title={<>BEFORE vs <span className="text-gold-gradient">AFTER LEADFLOW</span></>} desc="See the difference LeadFlow CRM makes for your sales team." />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }} className="before-after-grid">
          {/* Before */}
          <div style={{ background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 16, padding: '20px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </div>
              <h4 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.05rem', fontWeight: 900, color: '#991B1B' }}>Without LeadFlow</h4>
            </div>
            {beforeItems.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" style={{ flexShrink: 0, marginTop: 2 }}><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                <span style={{ fontSize: '0.82rem', color: '#7F1D1D', lineHeight: 1.5 }}>{item.text}</span>
              </div>
            ))}
          </div>
          {/* After */}
          <div style={{ background: '#F0FDF4', border: '2px solid #EAB308', borderRadius: 16, padding: '20px 18px', position: 'relative', boxShadow: '0 8px 24px rgba(234, 179, 8, 0.12)' }}>
            <div style={{ position: 'absolute', top: -11, right: 16, background: 'linear-gradient(135deg, #FEF08A, #EAB308)', color: '#422006', fontWeight: 900, fontSize: '0.68rem', padding: '3px 12px', borderRadius: 9999, border: '1px solid #CA8A04' }}>WITH LEADFLOW</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #FEF08A, #EAB308)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#422006" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <h4 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.05rem', fontWeight: 900, color: '#15803D' }}>With LeadFlow CRM</h4>
            </div>
            {afterItems.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" style={{ flexShrink: 0, marginTop: 2 }}><circle cx="12" cy="12" r="10" /><polyline points="9 12 11 14 15 10" /></svg>
                <span style={{ fontSize: '0.82rem', color: '#166534', lineHeight: 1.5, fontWeight: 600 }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ===================== Trust / Guarantee Section =====================
function TrustGuarantee() {
  const badges = [
    { icon: 'shield', title: 'No Credit Card Required', desc: 'Start your 14-day trial with zero payment. No hidden charges.' },
    { icon: 'lock', title: 'Bank-Grade Encryption', desc: 'Your data is encrypted at rest and in transit. We never sell your data.' },
    { icon: 'refresh', title: 'Cancel Anytime', desc: 'No lock-in contracts. Upgrade, downgrade, or cancel from your dashboard.' },
    { icon: 'headset', title: '24/7 Support', desc: 'Our team is available round the clock via chat, email, and phone.' },
  ];
  return (
    <section style={{ paddingBottom: 50 }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px' }}>
        <div style={{ background: 'linear-gradient(135deg, #FFFDF5 0%, #FEF9C3 100%)', borderRadius: 18, border: '1.5px solid rgba(234, 179, 8, 0.3)', padding: '24px 18px', boxShadow: '0 6px 24px rgba(234, 179, 8, 0.08)' }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 14px', borderRadius: 9999, background: 'rgba(22, 163, 74, 0.1)', border: '1px solid rgba(22, 163, 74, 0.3)', marginBottom: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#15803D', textTransform: 'uppercase', letterSpacing: '0.5px' }}>100% Risk-Free</span>
            </div>
            <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.3rem', fontWeight: 900, color: '#0F172A' }}>Your Business Is In Safe Hands</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }} className="trust-grid">
            {badges.map((b) => (
              <div key={b.title} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: '#FFFFFF', borderRadius: 12, padding: '12px 14px', border: '1px solid rgba(0,0,0,0.06)' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#CA8A04" strokeWidth="2">
                    {b.icon === 'shield' && <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />}
                    {b.icon === 'lock' && <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>}
                    {b.icon === 'refresh' && <><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></>}
                    {b.icon === 'headset' && <><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" /></>}
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0F172A', marginBottom: 2 }}>{b.title}</div>
                  <div style={{ fontSize: '0.75rem', color: '#475569', lineHeight: 1.4 }}>{b.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ===================== Exit Intent Popup =====================
function ExitIntentPopup() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !sessionStorage.getItem('exit-popup-shown')) {
        setShow(true);
        sessionStorage.setItem('exit-popup-shown', '1');
      }
    };
    document.addEventListener('mouseleave', handleMouseLeave);
    return () => document.removeEventListener('mouseleave', handleMouseLeave);
  }, []);

  if (!show) return null;

  return (
    <div
      onClick={() => setShow(false)}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 10001,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        animation: 'setup-fade-in 0.2s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#FFFFFF',
          borderRadius: 20,
          maxWidth: 440,
          width: '100%',
          padding: '28px 24px',
          textAlign: 'center',
          position: 'relative',
          boxShadow: '0 25px 70px rgba(0,0,0,0.35)',
          border: '2px solid #EAB308',
          animation: 'setup-slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <button
          onClick={() => setShow(false)}
          aria-label="Close"
          style={{ position: 'absolute', top: 12, right: 14, background: 'rgba(0,0,0,0.05)', border: 'none', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', fontSize: 18, color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          &times;
        </button>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #FEF08A, #EAB308)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', boxShadow: '0 6px 20px rgba(234, 179, 8, 0.35)' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#422006" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
        </div>
        <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.4rem', fontWeight: 900, color: '#0F172A', marginBottom: 8 }}>Wait! Get 30 Days Free</h3>
        <p style={{ fontSize: '0.88rem', color: '#475569', lineHeight: 1.5, marginBottom: 16 }}>
          Don&apos;t leave yet! Use code <strong style={{ color: '#CA8A04', fontFamily: 'monospace', fontSize: '0.92rem' }}>DOUBLE30</strong> to get <strong style={{ color: '#0F172A' }}>30 days free</strong> instead of 14. Limited to the next 50 signups.
        </p>
        <div style={{ background: '#FEF2F2', borderRadius: 10, padding: '8px 14px', marginBottom: 16, border: '1px solid #FECACA' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#DC2626' }}>Only 17 bonus spots remaining!</span>
        </div>
        <a
          href="#signup"
          onClick={(e) => { e.preventDefault(); setShow(false); window.location.hash = 'signup'; }}
          className="gold-cta"
          style={{ width: '100%', maxWidth: '100%' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
          <span>CLAIM 30 DAYS FREE</span>
        </a>
        <p style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 10 }}>No credit card required &bull; Cancel anytime</p>
      </div>
    </div>
  );
}

// ===================== Floating Help Widget =====================
function HelpWidget() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        aria-label="Help"
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #FEF08A, #EAB308, #CA8A04)',
          border: '2px solid #CA8A04',
          boxShadow: '0 6px 20px rgba(234, 179, 8, 0.4)',
          cursor: 'pointer',
          zIndex: 9998,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.2s ease',
        }}
        className="help-widget-btn"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#422006" strokeWidth="2.5">
          {open ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></> : <><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></>}
        </svg>
      </button>
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: 84,
            right: 20,
            width: 300,
            background: '#FFFFFF',
            borderRadius: 16,
            boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
            border: '1px solid rgba(0,0,0,0.08)',
            zIndex: 9998,
            overflow: 'hidden',
            animation: 'setup-slide-up 0.2s ease',
          }}
        >
          <div style={{ background: 'linear-gradient(135deg, #FEF08A, #EAB308)', padding: '16px 18px' }}>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1rem', fontWeight: 900, color: '#422006' }}>How can we help?</div>
            <div style={{ fontSize: '0.72rem', color: '#78350F', marginTop: 2 }}>Typically replies in minutes</div>
          </div>
          <div style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a href="#signup" onClick={(e) => { e.preventDefault(); setOpen(false); window.location.hash = 'signup'; }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.06)', textDecoration: 'none', cursor: 'pointer' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0F172A' }}>Start free trial</span>
              </a>
              <a href="#pricing" onClick={(e) => { e.preventDefault(); setOpen(false); document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' }); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.06)', textDecoration: 'none', cursor: 'pointer' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#CA8A04" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0F172A' }}>View pricing plans</span>
              </a>
              <a href="#faq" onClick={(e) => { e.preventDefault(); setOpen(false); document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' }); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.06)', textDecoration: 'none', cursor: 'pointer' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0F172A' }}>Read FAQs</span>
              </a>
            </div>
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(0,0,0,0.06)', fontSize: '0.72rem', color: '#94A3B8', textAlign: 'center' }}>
              Need more help? Email us at hello@leadflowcrm.com
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ===================== Geographic Coverage =====================
function GeographicCoverage() {
  const cities = [
    { name: 'Delhi', x: 32, y: 22, size: 14 },
    { name: 'Mumbai', x: 20, y: 55, size: 16 },
    { name: 'Bengaluru', x: 35, y: 78, size: 13 },
    { name: 'Jaipur', x: 30, y: 33, size: 10 },
    { name: 'Pune', x: 24, y: 58, size: 11 },
    { name: 'Hyderabad', x: 40, y: 62, size: 11 },
    { name: 'Chennai', x: 48, y: 72, size: 10 },
    { name: 'Kolkata', x: 55, y: 38, size: 12 },
    { name: 'Ahmedabad', x: 22, y: 40, size: 10 },
    { name: 'Chandigarh', x: 33, y: 17, size: 8 },
    { name: 'Lucknow', x: 42, y: 28, size: 9 },
    { name: 'Indore', x: 30, y: 45, size: 8 },
  ];
  return (
    <section style={{ paddingBottom: 50 }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px' }}>
        <SectionHeader pill="PAN-INDIA PRESENCE" title={<>TRUSTED ACROSS <span className="text-gold-gradient">120+ CITIES</span></>} desc="Businesses from every corner of India use LeadFlow CRM to grow their sales." />
        <div style={{ background: '#FFFFFF', borderRadius: 18, border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 6px 24px rgba(0,0,0,0.04)', padding: '24px 18px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="geo-grid">
            {/* Map */}
            <div style={{ position: 'relative', height: 340, background: 'linear-gradient(135deg, #F8FAFC, #F1F5F9)', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', overflow: 'hidden' }} className="geo-map">
              {/* Simplified India outline */}
              <svg viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.15 }}>
                <path d="M35 8 L42 8 L50 12 L55 18 L58 25 L60 30 L65 32 L62 38 L58 42 L55 48 L52 55 L48 60 L42 68 L38 75 L35 82 L32 88 L30 82 L28 72 L25 62 L22 55 L20 48 L18 40 L20 32 L22 25 L28 18 L32 12 Z" fill="#EAB308" stroke="#CA8A04" strokeWidth="0.3" />
              </svg>
              {/* City pins */}
              {cities.map((c) => (
                <div key={c.name} style={{ position: 'absolute', left: `${c.x}%`, top: `${c.y}%`, transform: 'translate(-50%, -50%)' }}>
                  <div style={{ position: 'relative' }}>
                    <div style={{ width: c.size, height: c.size, borderRadius: '50%', background: 'linear-gradient(135deg, #FEF08A, #EAB308)', border: '2px solid #CA8A04', boxShadow: '0 2px 8px rgba(234, 179, 8, 0.4)', animation: 'pulse-dot 2s infinite' }} />
                    <span style={{ position: 'absolute', left: '50%', top: c.size + 4, transform: 'translateX(-50%)', fontSize: '0.62rem', fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap', textShadow: '0 1px 2px rgba(255,255,255,0.8)' }}>{c.name}</span>
                  </div>
                </div>
              ))}
            </div>
            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div style={{ textAlign: 'center', padding: '14px 8px', background: '#F8FAFC', borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)' }}>
                <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.5rem', fontWeight: 900, color: '#CA8A04' }}>120+</div>
                <div style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 600 }}>Cities</div>
              </div>
              <div style={{ textAlign: 'center', padding: '14px 8px', background: '#F8FAFC', borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)' }}>
                <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.5rem', fontWeight: 900, color: '#CA8A04' }}>28</div>
                <div style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 600 }}>States</div>
              </div>
              <div style={{ textAlign: 'center', padding: '14px 8px', background: '#F8FAFC', borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)' }}>
                <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.5rem', fontWeight: 900, color: '#CA8A04' }}>5K+</div>
                <div style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 600 }}>Businesses</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ===================== Logo Cloud =====================
function LogoCloud() {
  const logos = [
    { name: 'Sharma Properties', icon: 'home' },
    { name: 'Patel Insurance', icon: 'shield' },
    { name: 'EduFirst Academy', icon: 'book' },
    { name: 'FinEdge Capital', icon: 'wallet' },
    { name: 'CarePlus Health', icon: 'heart' },
    { name: 'ShopSmart D2C', icon: 'shopping' },
    { name: 'GrowMore Realty', icon: 'building' },
    { name: 'QuickInsure', icon: 'umbrella' },
  ];
  return (
    <section style={{ paddingBottom: 40 }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px' }}>
        <p style={{ textAlign: 'center', fontSize: '0.76rem', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: 18 }}>
          Trusted by 5,000+ businesses across India
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }} className="logo-cloud-grid">
          {logos.map((logo) => (
            <div key={logo.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 10px', background: '#FFFFFF', borderRadius: 10, border: '1px solid rgba(0,0,0,0.06)', transition: 'all 0.2s ease' }} className="logo-cloud-item">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#CA8A04" strokeWidth="2" style={{ flexShrink: 0, opacity: 0.7 }}>
                {logo.icon === 'home' && <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>}
                {logo.icon === 'shield' && <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />}
                {logo.icon === 'book' && <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>}
                {logo.icon === 'wallet' && <><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></>}
                {logo.icon === 'heart' && <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />}
                {logo.icon === 'shopping' && <><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></>}
                {logo.icon === 'building' && <><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4" /><path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01" /></>}
                {logo.icon === 'umbrella' && <><path d="M12 2L4 9a8 8 0 0 1 16 0l-8-7z" /><path d="M12 2v20" /><path d="M8 14a4 4 0 0 0 8 0" /></>}
              </svg>
              <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.76rem', fontWeight: 800, color: '#475569', whiteSpace: 'nowrap' }}>{logo.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===================== Onboarding Checklist =====================
function OnboardingChecklist() {
  const steps = [
    { num: 1, title: 'Import Your Leads', desc: 'Upload a CSV or connect Google Sheets to import all your leads in one go.', time: '2 min' },
    { num: 2, title: 'Connect WhatsApp', desc: 'Link your WhatsApp Business number to start sending bulk messages.', time: '1 min' },
    { num: 3, title: 'Set Pipeline Stages', desc: 'Customize your sales pipeline stages to match your team\'s workflow.', time: '1 min' },
    { num: 4, title: 'Invite Your Team', desc: 'Add team members with role-based permissions and lead assignment.', time: '30 sec' },
    { num: 5, title: 'Start Automating', desc: 'Set up follow-up schedules and broadcast campaigns. You\'re live!', time: '30 sec' },
  ];
  const [checked, setChecked] = useState<Set<number>>(new Set([1, 2]));

  const toggle = (n: number) => {
    const next = new Set(checked);
    if (next.has(n)) next.delete(n);
    else next.add(n);
    setChecked(next);
  };

  return (
    <section style={{ paddingBottom: 55 }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px' }}>
        <SectionHeader pill="QUICK SETUP" title={<>LIVE IN <span className="text-gold-gradient">5 MINUTES</span></>} desc="No technical knowledge required. Here's your setup checklist." />
        <div style={{ background: '#FFFFFF', borderRadius: 18, border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 6px 24px rgba(0,0,0,0.04)', padding: '20px 18px' }}>
          {steps.map((step, i) => {
            const isChecked = checked.has(step.num);
            return (
              <div key={step.num} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', paddingBottom: i < steps.length - 1 ? 16 : 0, marginBottom: i < steps.length - 1 ? 16 : 0, borderBottom: i < steps.length - 1 ? '1px dashed rgba(0,0,0,0.08)' : 'none' }}>
                <div
                  onClick={() => toggle(step.num)}
                  style={{
                    width: 32, height: 32, borderRadius: '50%',
                    border: isChecked ? '2px solid #16A34A' : '2px solid #E2E8F0',
                    background: isChecked ? '#22C55E' : '#FFFFFF',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s ease',
                  }}
                >
                  {isChecked ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                  ) : (
                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#94A3B8' }}>{step.num}</span>
                  )}
                </div>
                <div style={{ flex: 1, opacity: isChecked ? 0.6 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <h4 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.92rem', fontWeight: 800, color: '#0F172A', textDecoration: isChecked ? 'line-through' : 'none' }}>{step.title}</h4>
                    <span style={{ fontSize: '0.64rem', fontWeight: 700, color: '#CA8A04', background: 'rgba(234,179,8,0.1)', padding: '2px 7px', borderRadius: 9999, flexShrink: 0 }}>{step.time}</span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.5 }}>{step.desc}</p>
                </div>
              </div>
            );
          })}
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <span style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 700 }}>
              {checked.size} of {steps.length} steps complete
            </span>
            <div style={{ flex: 1, maxWidth: 200, height: 8, borderRadius: 9999, background: '#F1F5F9', overflow: 'hidden', margin: '0 12px' }}>
              <div style={{ height: '100%', width: `${(checked.size / steps.length) * 100}%`, background: 'linear-gradient(90deg, #22C55E, #16A34A)', borderRadius: 9999, transition: 'width 0.4s ease' }} />
            </div>
            <a href="#signup" onClick={(e) => { e.preventDefault(); window.location.hash = 'signup'; }} className="gold-cta" style={{ padding: '8px 18px', fontSize: '0.78rem' }}>
              <span>START NOW</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

// ===================== Success Metrics Carousel =====================
function SuccessMetrics() {
  const [active, setActive] = useState(0);
  const stories = [
    { company: 'Sharma Real Estate', location: 'New Delhi', metric: '+40%', label: 'Close rate increase', desc: 'After implementing LeadFlow\'s pipeline and automated follow-ups, our agents close 40% more deals in the first 60 days.', person: 'Vikram Sharma', role: 'Sales Director' },
    { company: 'Patel Insurance Group', location: 'Mumbai', metric: '10 hrs', label: 'Saved per week', desc: 'WhatsApp broadcast eliminated manual messaging. Our team now spends that time actually talking to hot leads instead of typing messages.', person: 'Ananya Patel', role: 'Operations Head' },
    { company: 'EduFirst Academy', location: 'Pune', metric: '3x', label: 'Lead response speed', desc: 'Automated lead assignment and instant notifications cut our response time from 2 hours to under 15 minutes. Enrollment jumped 3x.', person: 'Rajesh Kumar', role: 'Admissions Lead' },
    { company: 'FinEdge Capital', location: 'Bengaluru', metric: '₹2.4Cr', label: 'Additional revenue tracked', desc: 'The analytics dashboard helped us identify which lead sources actually convert. We reallocated our ad spend and tracked ₹2.4Cr in new revenue.', person: 'Priya Nair', role: 'VP Sales' },
  ];

  useEffect(() => {
    const timer = setInterval(() => setActive((p) => (p + 1) % stories.length), 5000);
    return () => clearInterval(timer);
  }, [stories.length]);

  const s = stories[active];

  return (
    <section style={{ paddingBottom: 55 }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px' }}>
        <SectionHeader pill="SUCCESS STORIES" title={<>REAL <span className="text-gold-gradient">RESULTS</span></>} desc="See how businesses across India are growing with LeadFlow CRM." />
        <div style={{ background: 'linear-gradient(135deg, #FFFDF5 0%, #FEF9C3 100%)', borderRadius: 18, border: '1.5px solid rgba(234,179,8,0.3)', padding: '24px 20px', boxShadow: '0 8px 30px rgba(234,179,8,0.08)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', textAlign: 'center' }} className="success-metric-layout">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '3rem', fontWeight: 900, color: '#CA8A04', lineHeight: 1, animation: 'setup-fade-in 0.4s ease' }} key={s.metric}>{s.metric}</span>
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#475569' }}>{s.label}</span>
            </div>
            <p style={{ fontSize: '0.88rem', color: '#0F172A', lineHeight: 1.55, maxWidth: 500, fontStyle: 'italic' }}>"{s.desc}"</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #FEF08A, #EAB308)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.82rem', color: '#422006' }}>
                {s.person.split(' ').map((w) => w[0]).join('')}
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0F172A' }}>{s.person}</div>
                <div style={{ fontSize: '0.72rem', color: '#475569' }}>{s.role}, {s.company}</div>
              </div>
              <span style={{ fontSize: '0.66rem', color: '#15803D', background: 'rgba(22,163,74,0.1)', padding: '2px 8px', borderRadius: 9999, fontWeight: 700, marginLeft: 4 }}>&#10003; Verified</span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              {stories.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  aria-label={`Story ${i + 1}`}
                  style={{
                    width: i === active ? 24 : 8, height: 8, borderRadius: 9999,
                    border: 'none', cursor: 'pointer',
                    background: i === active ? 'linear-gradient(90deg, #FEF08A, #EAB308)' : 'rgba(0,0,0,0.15)',
                    transition: 'all 0.3s ease',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ===================== Countdown Timer Urgency =====================
function CountdownTimer() {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const STORAGE_KEY = 'leadflow-deadline';
    let deadline = sessionStorage.getItem(STORAGE_KEY);
    if (!deadline) {
      const d = Date.now() + (23 * 3600 + 14 * 60 + 7) * 1000;
      deadline = String(d);
      sessionStorage.setItem(STORAGE_KEY, deadline);
    }
    const tick = () => {
      const remaining = Math.max(Number(deadline) - Date.now(), 0);
      const h = Math.floor(remaining / 3600000);
      const m = Math.floor((remaining % 3600000) / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      setTimeLeft({ hours: h, minutes: m, seconds: s });
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <section style={{ paddingBottom: 40 }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px' }}>
        <div style={{ background: 'linear-gradient(135deg, #0F172A, #1E293B)', borderRadius: 16, padding: '20px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, border: '1px solid rgba(234,179,8,0.3)', boxShadow: '0 8px 30px rgba(0,0,0,0.15)' }} className="countdown-banner">
          <div style={{ textAlign: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 9999, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', fontSize: '0.68rem', fontWeight: 800, color: '#FCA5A5', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              Limited Time Offer
            </span>
            <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.2rem', fontWeight: 900, color: '#F1F5F9', marginBottom: 4 }}>Extended Trial Ends Soon</h3>
            <p style={{ fontSize: '0.78rem', color: '#94A3B8' }}>Get 30 days free instead of 14. Offer expires in:</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              { v: timeLeft.hours, l: 'Hrs' },
              { v: timeLeft.minutes, l: 'Min' },
              { v: timeLeft.seconds, l: 'Sec' },
            ].map((unit) => (
              <div key={unit.l} style={{ textAlign: 'center', background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: 10, padding: '8px 12px', minWidth: 56 }}>
                <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.6rem', fontWeight: 900, color: '#FACC15', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{pad(unit.v)}</div>
                <div style={{ fontSize: '0.62rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', marginTop: 3 }}>{unit.l}</div>
              </div>
            ))}
          </div>
          <a href="#signup" onClick={(e) => { e.preventDefault(); window.location.hash = 'signup'; }} className="gold-cta" style={{ marginTop: 2 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
            <span>CLAIM 30 DAYS FREE</span>
          </a>
        </div>
      </div>
    </section>
  );
}

// ===================== Feature Deep-Dive Tabs =====================
function FeatureDeepDive() {
  const features = [
    {
      name: 'Pipeline Management',
      icon: 'kanban',
      headline: 'Visual drag-and-drop pipeline',
      desc: 'Track every lead from first contact to closed deal. Drag leads between stages, assign to team members, and see your entire sales funnel at a glance.',
      points: ['Customizable pipeline stages', 'Drag-and-drop lead cards', 'Auto-assignment rules', 'Stage-based automations'],
    },
    {
      name: 'WhatsApp Broadcast',
      icon: 'whatsapp',
      headline: 'Bulk WhatsApp in one click',
      desc: 'Connect your WhatsApp Business number and send personalized bulk messages to thousands of leads instantly. Track delivery and read receipts.',
      points: ['Personalized merge fields', 'Template message support', 'Delivery & read tracking', 'Multi-number support'],
    },
    {
      name: 'Automation Builder',
      icon: 'automation',
      headline: 'Automate your entire workflow',
      desc: 'Build custom automation rules without code. Trigger actions on lead stage changes, new lead creation, or scheduled timers.',
      points: ['Visual rule builder', 'Conditional triggers', 'Multi-step sequences', 'Webhook integrations'],
    },
    {
      name: 'Analytics & Reports',
      icon: 'chart',
      headline: 'Data-driven sales decisions',
      desc: 'Real-time dashboards show conversion rates, revenue forecasts, agent performance, and win/loss analysis. Export reports in one click.',
      points: ['Revenue forecasting', 'Agent leaderboard', 'Win/loss analysis', 'Custom date ranges'],
    },
  ];
  const [active, setActive] = useState(0);
  const f = features[active];

  return (
    <section id="features" style={{ paddingBottom: 55 }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px' }}>
        <SectionHeader pill="DEEP DIVE" title={<>EXPLORE THE <span className="text-gold-gradient">FEATURES</span></>} desc="Click a tab to see how each feature works." />
        {/* Tabs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
          {features.map((feat, i) => (
            <button
              key={feat.name}
              onClick={() => setActive(i)}
              style={{
                padding: '8px 16px', borderRadius: 10, cursor: 'pointer',
                fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '0.78rem',
                border: active === i ? '1.5px solid #EAB308' : '1px solid rgba(0,0,0,0.1)',
                background: active === i ? 'linear-gradient(135deg, #FEF08A, #EAB308)' : '#FFFFFF',
                color: active === i ? '#422006' : '#475569',
                transition: 'all 0.2s ease',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {feat.icon === 'kanban' && <><rect x="3" y="3" width="6" height="18" rx="1" /><rect x="15" y="3" width="6" height="12" rx="1" /></>}
                {feat.icon === 'whatsapp' && <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />}
                {feat.icon === 'automation' && <><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></>}
                {feat.icon === 'chart' && <><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" /></>}
              </svg>
              {feat.name}
            </button>
          ))}
        </div>
        {/* Content */}
        <div key={active} style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 6px 24px rgba(0,0,0,0.04)', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 18, animation: 'setup-fade-in 0.3s ease' }} className="deep-dive-layout">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} className="deep-dive-text">
            <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.3rem', fontWeight: 900, color: '#0F172A' }}>{f.headline}</h3>
            <p style={{ fontSize: '0.86rem', color: '#475569', lineHeight: 1.55 }}>{f.desc}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {f.points.map((p) => (
                <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#F8FAFC', borderRadius: 10, border: '1px solid rgba(0,0,0,0.05)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0F172A' }}>{p}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Mockup preview */}
          <div style={{ background: '#F1F5F9', borderRadius: 12, padding: '16px 14px', border: '1px solid rgba(0,0,0,0.06)' }} className="deep-dive-mockup">
            {f.icon === 'kanban' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {['New', 'In Progress', 'Won'].map((stage, si) => (
                  <div key={stage} style={{ background: '#FFFFFF', borderRadius: 8, padding: 8, border: '1px solid rgba(0,0,0,0.06)' }}>
                    <div style={{ fontSize: '0.64rem', fontWeight: 800, color: '#475569', marginBottom: 6, textTransform: 'uppercase' }}>{stage}</div>
                    {Array.from({ length: 2 + si }).map((_, ci) => (
                      <div key={ci} style={{ background: '#F8FAFC', borderRadius: 6, padding: '6px 8px', marginBottom: 4, border: '1px solid rgba(0,0,0,0.04)' }}>
                        <div style={{ height: 6, width: '70%', background: '#E2E8F0', borderRadius: 3, marginBottom: 3 }} />
                        <div style={{ height: 4, width: '50%', background: '#E2E8F0', borderRadius: 3 }} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
            {f.icon === 'whatsapp' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FFFFFF', borderRadius: 8, padding: '8px 10px', border: '1px solid rgba(0,0,0,0.06)' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#DCFCE8', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ height: 6, width: '60%', background: '#E2E8F0', borderRadius: 3, marginBottom: 3 }} />
                      <div style={{ height: 4, width: '40%', background: '#E2E8F0', borderRadius: 3 }} />
                    </div>
                    <div style={{ fontSize: '0.58rem', color: i === 1 ? '#22C55E' : '#94A3B8', fontWeight: 700, flexShrink: 0 }}>{i === 1 ? 'Read' : i === 2 ? 'Delivered' : 'Sent'}</div>
                  </div>
                ))}
              </div>
            )}
            {f.icon === 'automation' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {['Trigger: New Lead', 'Condition: Score > 70', 'Action: Assign to top agent', 'Action: Send WhatsApp'].map((step, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FFFFFF', borderRadius: 8, padding: '7px 10px', border: '1px solid rgba(0,0,0,0.06)' }}>
                    <div style={{ width: 20, height: 20, borderRadius: 6, background: `linear-gradient(135deg, #FEF08A, #EAB308)`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.58rem', fontWeight: 900, color: '#422006' }}>{i + 1}</div>
                    <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#475569' }}>{step}</span>
                  </div>
                ))}
              </div>
            )}
            {f.icon === 'chart' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
                {[
                  { label: 'Conversion', val: '34%', color: '#22C55E' },
                  { label: 'Revenue', val: '₹18L', color: '#EAB308' },
                  { label: 'New Leads', val: '847', color: '#0EA5E9' },
                  { label: 'Win Rate', val: '62%', color: '#A855F7' },
                ].map((stat) => (
                  <div key={stat.label} style={{ background: '#FFFFFF', borderRadius: 8, padding: '10px 12px', border: '1px solid rgba(0,0,0,0.06)' }}>
                    <div style={{ fontSize: '0.58rem', color: '#94A3B8', fontWeight: 700, marginBottom: 4 }}>{stat.label}</div>
                    <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.1rem', fontWeight: 900, color: stat.color }}>{stat.val}</div>
                    <div style={{ marginTop: 6, height: 4, borderRadius: 2, background: '#F1F5F9', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: '60%', background: stat.color, borderRadius: 2 }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ===================== Mobile Preview Section =====================
function MobilePreview() {
  return (
    <section style={{ paddingBottom: 55 }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px' }}>
        <SectionHeader pill="WORKS EVERYWHERE" title={<>YOUR CRM ON <span className="text-gold-gradient">EVERY DEVICE</span></>} desc="Manage leads from your desk or on the go. LeadFlow works seamlessly across desktop, tablet, and mobile." />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center' }} className="mobile-preview-layout">
          {/* Desktop mockup */}
          <div style={{ width: '100%', maxWidth: 560, background: '#FFFFFF', borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 10px 30px rgba(0,0,0,0.06)', padding: 12, overflow: 'hidden' }} className="desktop-mockup">
            <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444' }} />
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B' }} />
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ width: 80, background: '#0F172A', borderRadius: 8, padding: 8, flexShrink: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {['Pipeline', 'Leads', 'Inbox', 'Broadcast', 'Analytics'].map((label, i) => (
                    <div key={label} style={{ padding: '4px 6px', borderRadius: 4, background: i === 0 ? 'rgba(234,179,8,0.2)' : 'transparent', fontSize: '0.58rem', color: i === 0 ? '#FACC15' : '#64748B', fontWeight: 700 }}>{label}</div>
                  ))}
                </div>
              </div>
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                {['New', 'Follow-up', 'Won'].map((stage, si) => (
                  <div key={stage} style={{ background: '#F8FAFC', borderRadius: 6, padding: 6, border: '1px solid rgba(0,0,0,0.04)' }}>
                    <div style={{ fontSize: '0.52rem', fontWeight: 800, color: '#475569', marginBottom: 4 }}>{stage}</div>
                    {Array.from({ length: 2 + si }).map((_, ci) => (
                      <div key={ci} style={{ background: '#FFFFFF', borderRadius: 4, padding: 5, marginBottom: 3, border: '1px solid rgba(0,0,0,0.04)' }}>
                        <div style={{ height: 4, width: '70%', background: '#E2E8F0', borderRadius: 2, marginBottom: 2 }} />
                        <div style={{ height: 3, width: '45%', background: '#E2E8F0', borderRadius: 2 }} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Phone mockup */}
          <div style={{ width: 200, background: '#0F172A', borderRadius: 24, padding: 5, boxShadow: '0 15px 40px rgba(0,0,0,0.2)' }} className="phone-mockup">
            <div style={{ background: '#FFFFFF', borderRadius: 20, padding: 10, minHeight: 280 }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                <div style={{ width: 40, height: 4, background: '#0F172A', borderRadius: 2 }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #FEF08A, #EAB308)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#422006" strokeWidth="2.5"><path d="M3 17l6-6 4 4 8-8" /><path d="M21 7v4h-4" /></svg>
                </div>
                <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.68rem', fontWeight: 900, color: '#0F172A' }}>LeadFlow</span>
              </div>
              {['Rajesh K.', 'Ananya P.', 'Vikram S.', 'Priya N.'].map((name, i) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 6px', borderBottom: i < 3 ? '1px solid rgba(0,0,0,0.04)' : 'none' }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: `linear-gradient(135deg, ${['#FEF08A,#EAB308', '#DCFCE8,#22C55E', '#DBEAFE,#3B82F6', '#FCE7F3,#EC4899'][i]})`, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.58rem', fontWeight: 700, color: '#0F172A' }}>{name}</div>
                    <div style={{ fontSize: '0.5rem', color: '#94A3B8' }}>{['New Lead', 'Follow-up', 'Hot Lead', 'Closed'][i]}</div>
                  </div>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: ['#22C55E', '#F59E0B', '#EF4444', '#22C55E'][i] }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ===================== Resources / Blog Preview =====================
function ResourcesPreview() {
  const articles = [
    { title: '10 WhatsApp Follow-up Templates That Convert', category: 'Sales Tips', readTime: '5 min read', color: '#22C55E' },
    { title: 'How to Score Leads: A Complete Guide for Sales Teams', category: 'Lead Management', readTime: '8 min read', color: '#0EA5E9' },
    { title: '5 Automation Rules Every Sales Team Should Set Up', category: 'Automation', readTime: '6 min read', color: '#EAB308' },
  ];
  return (
    <section style={{ paddingBottom: 50 }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px' }}>
        <SectionHeader pill="FREE RESOURCES" title={<>SALES TIPS & <span className="text-gold-gradient">GUIDES</span></>} desc="Learn from our sales experts. Free articles to help your team close more deals." />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }} className="resources-grid">
          {articles.map((a) => (
            <div key={a.title} style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 3px 12px rgba(0,0,0,0.02)', overflow: 'hidden', display: 'flex', flexDirection: 'column', cursor: 'pointer', transition: 'all 0.2s ease' }} className="resource-card">
              <div style={{ height: 80, background: `linear-gradient(135deg, ${a.color}15, ${a.color}30)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={a.color} strokeWidth="1.5">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
              </div>
              <div style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: '0.62rem', fontWeight: 800, color: a.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{a.category}</span>
                  <span style={{ fontSize: '0.62rem', color: '#94A3B8' }}>&bull; {a.readTime}</span>
                </div>
                <h4 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem', fontWeight: 800, color: '#0F172A', lineHeight: 1.4, marginBottom: 10 }}>{a.title}</h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.74rem', fontWeight: 700, color: '#CA8A04' }}>
                  <span>Read article</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===================== Competitor Comparison =====================
function CompetitorComparison() {
  const features = [
    { label: 'WhatsApp Native Broadcast', leadflow: true, salesforce: false, zoho: false, hubspot: false },
    { label: 'Setup Time', leadflow: '5 min', salesforce: '2+ hrs', zoho: '1+ hr', hubspot: '45 min' },
    { label: 'Starting Price (INR/mo)', leadflow: '₹999', salesforce: '₹7,500', zoho: '₹1,500', hubspot: 'Free*' },
    { label: 'Bulk WhatsApp Messages', leadflow: true, salesforce: false, zoho: false, hubspot: false },
    { label: 'Automated Follow-up Reminders', leadflow: true, salesforce: true, zoho: true, hubspot: true },
    { label: 'Visual Drag-and-Drop Pipeline', leadflow: true, salesforce: true, zoho: true, hubspot: true },
    { label: 'Built-in Team Chat', leadflow: true, salesforce: false, zoho: false, hubspot: false },
    { label: 'Lead Scoring', leadflow: true, salesforce: true, zoho: true, hubspot: 'Paid only' },
    { label: 'Google Sheets Sync', leadflow: true, salesforce: 'Add-on', zoho: 'Add-on', hubspot: false },
    { label: 'India-based Support', leadflow: true, salesforce: false, zoho: false, hubspot: false },
  ];
  const renderCell = (val: boolean | string) => {
    if (val === true) return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>;
    if (val === false) return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
    return <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569' }}>{val}</span>;
  };
  return (
    <section style={{ paddingBottom: 55 }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px' }}>
        <SectionHeader pill="HOW WE COMPARE" title={<>LEADFLOW vs <span className="text-gold-gradient">THE COMPETITION</span></>} desc="See why thousands of businesses choose LeadFlow over expensive, complex CRMs." />
        <div style={{ overflowX: 'auto', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 6px 24px rgba(0,0,0,0.04)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600, background: '#FFFFFF' }}>
            <thead>
              <tr>
                <th style={{ padding: '14px 12px', textAlign: 'left', fontSize: '0.76rem', fontWeight: 800, color: '#475569', borderBottom: '2px solid rgba(234,179,8,0.3)', background: '#F8FAFC' }}>Feature</th>
                <th style={{ padding: '14px 10px', textAlign: 'center', fontSize: '0.78rem', fontWeight: 900, color: '#422006', borderBottom: '2px solid #EAB308', background: 'linear-gradient(135deg, #FEF08A, #FEF9C3)' }}>LeadFlow</th>
                <th style={{ padding: '14px 10px', textAlign: 'center', fontSize: '0.74rem', fontWeight: 700, color: '#475569', borderBottom: '2px solid rgba(0,0,0,0.06)', background: '#F8FAFC' }}>Salesforce</th>
                <th style={{ padding: '14px 10px', textAlign: 'center', fontSize: '0.74rem', fontWeight: 700, color: '#475569', borderBottom: '2px solid rgba(0,0,0,0.06)', background: '#F8FAFC' }}>Zoho</th>
                <th style={{ padding: '14px 10px', textAlign: 'center', fontSize: '0.74rem', fontWeight: 700, color: '#475569', borderBottom: '2px solid rgba(0,0,0,0.06)', background: '#F8FAFC' }}>HubSpot</th>
              </tr>
            </thead>
            <tbody>
              {features.map((row, i) => (
                <tr key={row.label} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#FAFAFA' }}>
                  <td style={{ padding: '11px 12px', fontSize: '0.78rem', fontWeight: 700, color: '#0F172A', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>{row.label}</td>
                  <td style={{ padding: '11px 10px', textAlign: 'center', borderBottom: '1px solid rgba(234,179,8,0.1)', background: 'rgba(254,249,195,0.3)' }}>{renderCell(row.leadflow)}</td>
                  <td style={{ padding: '11px 10px', textAlign: 'center', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>{renderCell(row.salesforce)}</td>
                  <td style={{ padding: '11px 10px', textAlign: 'center', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>{renderCell(row.zoho)}</td>
                  <td style={{ padding: '11px 10px', textAlign: 'center', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>{renderCell(row.hubspot)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: '0.68rem', color: '#94A3B8', textAlign: 'center', marginTop: 8 }}>Pricing and features based on publicly available information as of Oct 2026. *HubSpot free tier has limited features.</p>
      </div>
    </section>
  );
}

// ===================== Newsletter Capture =====================
function NewsletterCapture() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setStatus('error'); return; }
    setStatus('loading');
    setTimeout(() => setStatus('success'), 800);
  };
  return (
    <section style={{ paddingBottom: 50 }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px' }}>
        <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 6px 20px rgba(0,0,0,0.03)', padding: '22px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }} className="newsletter-card">
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#CA8A04" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
          </div>
          <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.15rem', fontWeight: 900, color: '#0F172A', marginBottom: 6 }}>Get Sales Tips in Your Inbox</h3>
          <p style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.5, marginBottom: 16, maxWidth: 400 }}>Join 8,000+ sales professionals receiving weekly tips on lead conversion, WhatsApp marketing, and CRM automation. No spam, unsubscribe anytime.</p>
          {status === 'success' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: '#F0FDF4', border: '1px solid rgba(22,163,74,0.3)', borderRadius: 10 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#15803D' }}>You're subscribed! Check your inbox.</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 400 }} className="newsletter-form">
              <input
                type="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setStatus('idle'); }}
                style={{ padding: '11px 14px', borderRadius: 10, border: status === 'error' ? '1.5px solid #EF4444' : '1px solid rgba(0,0,0,0.12)', fontSize: '0.84rem', fontFamily: 'inherit', outline: 'none', background: '#F8FAFC', width: '100%' }}
              />
              {status === 'error' && <span style={{ fontSize: '0.72rem', color: '#EF4444', fontWeight: 600 }}>Please enter a valid email address.</span>}
              <button type="submit" disabled={status === 'loading'} className="gold-cta" style={{ width: '100%', maxWidth: '100%', padding: '11px 20px', fontSize: '0.82rem', opacity: status === 'loading' ? 0.7 : 1 }}>
                {status === 'loading' ? 'SUBSCRIBING...' : 'SUBSCRIBE FREE'}
                {status !== 'loading' && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

// ===================== Scroll Progress Bar =====================
function ScrollProgressBar() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(docHeight > 0 ? (scrollTop / docHeight) * 100 : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: 3, zIndex: 10002, background: 'transparent', pointerEvents: 'none' }}>
      <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #FEF08A, #EAB308, #CA8A04)', transition: 'width 0.1s ease', boxShadow: '0 0 8px rgba(234,179,8,0.4)' }} />
    </div>
  );
}

// ===================== Time Savings Calculator =====================
function TimeSavingsCalculator() {
  const [leads, setLeads] = useState(50);
  const manualMinutesPerLead = 4;
  const leadflowMinutesPerLead = 0.5;
  const manualHrs = (leads * manualMinutesPerLead) / 60;
  const leadflowHrs = (leads * leadflowMinutesPerLead) / 60;
  const savedHrs = manualHrs - leadflowHrs;
  const savedPerWeek = savedHrs * 7;
  const savedPerMonth = savedPerWeek * 4.3;

  return (
    <section style={{ paddingBottom: 55 }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px' }}>
        <SectionHeader pill="TIME SAVINGS" title={<>HOW MANY HOURS WILL <span className="text-gold-gradient">LEADFLOW SAVE YOU?</span></>} desc="Slide to see how much time your team saves every week with LeadFlow automation." />
        <div style={{ background: '#FFFFFF', borderRadius: 18, border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 6px 24px rgba(0,0,0,0.04)', padding: '24px 20px' }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <label style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0F172A' }}>Leads managed daily</label>
              <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.3rem', fontWeight: 900, color: '#CA8A04' }}>{leads}</span>
            </div>
            <input
              type="range"
              min={5}
              max={500}
              step={5}
              value={leads}
              onChange={(e) => setLeads(Number(e.target.value))}
              style={{ width: '100%', height: 8, borderRadius: 9999, background: 'linear-gradient(90deg, #FEF08A, #EAB308, #CA8A04)', outline: 'none', appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer' }}
              className="time-slider"
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ fontSize: '0.66rem', color: '#94A3B8' }}>5</span>
              <span style={{ fontSize: '0.66rem', color: '#94A3B8' }}>500</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }} className="time-savings-grid">
            <div style={{ textAlign: 'center', padding: '14px 8px', background: '#FEF2F2', borderRadius: 12, border: '1px solid #FECACA' }}>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.4rem', fontWeight: 900, color: '#EF4444' }}>{manualHrs.toFixed(1)}h</div>
              <div style={{ fontSize: '0.68rem', color: '#991B1B', fontWeight: 700, marginTop: 2 }}>Manual / day</div>
            </div>
            <div style={{ textAlign: 'center', padding: '14px 8px', background: '#F0FDF4', borderRadius: 12, border: '1px solid rgba(22,163,74,0.2)' }}>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.4rem', fontWeight: 900, color: '#16A34A' }}>{leadflowHrs.toFixed(1)}h</div>
              <div style={{ fontSize: '0.68rem', color: '#15803D', fontWeight: 700, marginTop: 2 }}>With LeadFlow / day</div>
            </div>
            <div style={{ textAlign: 'center', padding: '14px 8px', background: 'linear-gradient(135deg, #FEF08A, #FEF9C3)', borderRadius: 12, border: '1.5px solid #EAB308' }}>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.4rem', fontWeight: 900, color: '#CA8A04' }}>{savedHrs.toFixed(1)}h</div>
              <div style={{ fontSize: '0.68rem', color: '#854D0E', fontWeight: 700, marginTop: 2 }}>Saved / day</div>
            </div>
          </div>
          <div style={{ marginTop: 16, padding: '14px 16px', background: '#0F172A', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: '0.82rem', color: '#94A3B8', fontWeight: 600 }}>You save <strong style={{ color: '#FACC15', fontSize: '0.92rem' }}>{savedPerWeek.toFixed(0)} hrs/week</strong> and <strong style={{ color: '#FACC15', fontSize: '0.92rem' }}>{savedPerMonth.toFixed(0)} hrs/month</strong></span>
            <a href="#signup" onClick={(e) => { e.preventDefault(); window.location.hash = 'signup'; }} className="gold-cta" style={{ padding: '8px 16px', fontSize: '0.74rem', maxWidth: 'fit-content' }}>
              <span>START SAVING</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

// ===================== Awards & Certifications Strip =====================
function AwardsStrip() {
  const awards = [
    { label: 'G2 High Performer', sub: 'Winter 2026', icon: 'trophy' },
    { label: 'Best WhatsApp CRM', sub: 'SaaS Awards 2026', icon: 'star' },
    { label: 'ISO 27001 Certified', sub: 'Data Security', icon: 'shield' },
    { label: '4.8/5 Rating', sub: '500+ Reviews', icon: 'star' },
  ];
  return (
    <section style={{ paddingBottom: 40 }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }} className="awards-grid">
          {awards.map((a) => (
            <div key={a.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#FFFFFF', borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }} className="award-item">
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #FEF08A, #EAB308)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#422006" strokeWidth="2">
                  {a.icon === 'trophy' && <><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></>}
                  {a.icon === 'star' && <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />}
                  {a.icon === 'shield' && <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />}
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0F172A', lineHeight: 1.2 }}>{a.label}</div>
                <div style={{ fontSize: '0.66rem', color: '#94A3B8', marginTop: 1 }}>{a.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===================== Final CTA Section =====================
function FinalCTA() {
  const telegramLink = useTelegramLink();
  const badges = [
    '\u2713 Built for Sales Teams',
    '\u2713 14-Day Free CRM Trial',
    '\u2713 WhatsApp & Email Broadcast',
    '\u2713 No Credit Card Required',
  ];

  return (
    <section style={{ paddingBottom: 70 }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px' }}>
        <div
          style={{
            background: `linear-gradient(180deg, var(--landing-primary-light, #FFFDF5) 0%, var(--landing-primary-light, #FEF9C3) 100%)`,
            border: `1.5px solid var(--landing-primary, #EAB308)`,
            borderRadius: 20,
            padding: '30px 18px',
            textAlign: 'center',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.05), 0 6px 20px rgba(234, 179, 8, 0.15)',
          }}
        >
          <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.7rem', fontWeight: 900, marginBottom: 8, letterSpacing: '-0.3px', color: 'var(--landing-text, #0F172A)' }} className="final-cta-title">
            START YOUR <span className="text-gold-gradient">14-DAY FREE TRIAL</span>
          </h2>
          <p style={{ fontSize: '0.86rem', color: 'var(--landing-text-muted, #475569)', margin: '0 auto 20px auto', maxWidth: 480, lineHeight: 1.55 }}>
            Start your LeadFlow CRM free trial today. Get full access to lead management, automated follow-ups, WhatsApp &amp; Email broadcasts, and sales analytics — no credit card required!
          </p>
          <a href="#signup" onClick={(event) => { event.preventDefault(); window.location.hash = 'signup'; }} className="gold-cta" style={{ margin: '0 auto' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span>START FREE TRIAL &amp; GET CRM ACCESS</span>
          </a>
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 6, marginTop: 16 }}>
            {badges.map((b) => (
              <span
                key={b}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '6px 14px',
                  background: 'rgba(0, 0, 0, 0.04)',
                  border: '1px solid rgba(0, 0, 0, 0.08)',
                  borderRadius: '9999px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: '#475569',
                }}
              >
                {b}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ===================== Footer =====================
function Footer() {
  return (
    <footer
      style={{
        background: 'var(--landing-footer-bg, #09120F)',
        color: 'var(--landing-footer-text, #94A3B8)',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '0 0 85px 0',
        fontSize: '0.78rem',
        lineHeight: 1.55,
      }}
      className="footer"
    >
      {/* Brand strip */}
      <div style={{ borderTop: '1px solid rgba(234,179,8,0.12)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '24px 16px', background: 'rgba(255,255,255,0.015)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg, #FEF08A, #EAB308)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#422006" strokeWidth="2.5">
                <path d="M3 17l6-6 4 4 8-8" />
                <path d="M21 7v4h-4" />
              </svg>
            </div>
            <div>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: '0.92rem', color: '#F1F5F9', letterSpacing: '0.3px' }}>LeadFlow CRM</div>
              <div style={{ fontSize: '0.68rem', color: '#64748B', marginTop: 1 }}>All-in-One Sales &amp; Lead Management Platform</div>
            </div>
          </div>
          <a
            href="#signup"
            onClick={(event) => { event.preventDefault(); window.location.hash = 'signup'; }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '8px 16px', borderRadius: 8,
              background: 'linear-gradient(180deg, var(--landing-primary, #FACC15) 0%, var(--landing-primary-dark, #EAB308) 100%)',
              color: 'var(--landing-btn-text, #000000)',
              fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '0.76rem',
              textTransform: 'uppercase', letterSpacing: '0.3px',
              textDecoration: 'none', whiteSpace: 'nowrap',
              border: '1px solid #CA8A04',
              boxShadow: '0 3px 12px rgba(202,138,4,0.25)',
              cursor: 'pointer',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
            Start Free Trial
          </a>
        </div>
      </div>

      {/* Main content */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 16px 0 16px' }}>
        <div className="footer-grid" style={{ display: 'grid', gap: 24 }}>
          {/* Quick links */}
          <div className="footer-col">
            <h4 className="footer-heading" style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '0.78rem', color: '#E2E8F0', marginBottom: 12, letterSpacing: '0.4px', textTransform: 'uppercase' }}>Quick Links</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <li><a href="#features" style={{ color: '#94A3B8', textDecoration: 'none', fontSize: '0.76rem', transition: 'color 0.2s' }}>Features</a></li>
              <li><a href="#testimonials" style={{ color: '#94A3B8', textDecoration: 'none', fontSize: '0.76rem', transition: 'color 0.2s' }}>Testimonials</a></li>
              <li><a href="#about" onClick={(e) => { e.preventDefault(); window.location.hash = 'about'; }} style={{ color: '#94A3B8', textDecoration: 'none', fontSize: '0.76rem', transition: 'color 0.2s', cursor: 'pointer' }}>About Us</a></li>
              <li><a href="#careers" onClick={(e) => { e.preventDefault(); window.location.hash = 'careers'; }} style={{ color: '#94A3B8', textDecoration: 'none', fontSize: '0.76rem', transition: 'color 0.2s', cursor: 'pointer' }}>Careers</a></li>
              <li><a href="#security" onClick={(e) => { e.preventDefault(); window.location.hash = 'security'; }} style={{ color: '#94A3B8', textDecoration: 'none', fontSize: '0.76rem', transition: 'color 0.2s', cursor: 'pointer' }}>Security</a></li>
              <li><a href="#brand-assets" onClick={(e) => { e.preventDefault(); window.location.hash = 'brand-assets'; }} style={{ color: '#94A3B8', textDecoration: 'none', fontSize: '0.76rem', transition: 'color 0.2s', cursor: 'pointer' }}>Brand Assets</a></li>
              <li><a href="#report-abuse" onClick={(e) => { e.preventDefault(); window.location.hash = 'report-abuse'; }} style={{ color: '#94A3B8', textDecoration: 'none', fontSize: '0.76rem', transition: 'color 0.2s', cursor: 'pointer' }}>Report Abuse</a></li>
              <li><a href="#sitemap" onClick={(e) => { e.preventDefault(); window.location.hash = 'sitemap'; }} style={{ color: '#94A3B8', textDecoration: 'none', fontSize: '0.76rem', transition: 'color 0.2s', cursor: 'pointer' }}>Sitemap</a></li>
            </ul>
          </div>

          {/* Collapsible disclaimers */}
          <div className="footer-col">
            <button
              onClick={() => { window.location.hash = 'privacy'; }}
              className="footer-collapse-btn"
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 10, padding: '11px 14px', cursor: 'pointer',
                color: '#E2E8F0', fontWeight: 700, fontSize: '0.78rem',
                fontFamily: 'inherit', textAlign: 'left',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#EAB308" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                Privacy Policy
              </span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
            </button>
          </div>

          <div className="footer-col">
            <button
              onClick={() => { window.location.hash = 'terms'; }}
              className="footer-collapse-btn"
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 10, padding: '11px 14px', cursor: 'pointer',
                color: '#E2E8F0', fontWeight: 700, fontSize: '0.78rem',
                fontFamily: 'inherit', textAlign: 'left',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#EAB308" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                Terms & Conditions
              </span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>

        {/* Copyright bar */}
        <div className="copyright-row" style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 24, padding: '18px 0 20px 0', color: '#64748B', fontSize: '0.73rem' }}>
          <div>&copy; 2026 LeadFlow CRM. All Rights Reserved.</div>
          <div>
            <a href="#signup" onClick={(event) => { event.preventDefault(); window.location.hash = 'signup'; }} style={{ color: '#94A3B8', textDecoration: 'none', transition: 'color 0.2s ease', cursor: 'pointer' }}>
              Powered by <span style={{ color: '#FACC15', fontWeight: 700 }}>LeadFlow CRM Platform</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ===================== Mobile Sticky CTA =====================
function MobileStickyCTA() {
  const telegramLink = useTelegramLink();
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        width: '100%',
        background: 'var(--landing-footer-bg, rgba(9, 18, 15, 0.96))',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderTop: `1px solid var(--landing-primary, rgba(234, 179, 8, 0.5))`,
        padding: '9px 14px',
        zIndex: 999,
        boxShadow: '0 -6px 20px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
      }}
      className="mobile-sticky-cta"
    >
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: '0.84rem', color: '#FFFFFF', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          LEADFLOW CRM
        </span>
        <span style={{ fontSize: '0.7rem', color: '#FACC15', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          14-Day Free Trial (No Card Required)
        </span>
      </div>
      <a
        href="#signup"
        onClick={(event) => { event.preventDefault(); window.location.hash = 'signup'; }}
        className="mobile-join-link"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 5,
          background: `linear-gradient(180deg, var(--landing-primary, #FACC15) 0%, var(--landing-primary-dark, #EAB308) 100%)`,
          color: 'var(--landing-btn-text, #000000)',
          padding: '9px 16px',
          borderRadius: 8,
          fontFamily: 'Outfit, sans-serif',
          fontWeight: 900,
          fontSize: '0.82rem',
          textTransform: 'uppercase',
          letterSpacing: '0.3px',
          boxShadow: '0 3px 12px rgba(202, 138, 4, 0.3)',
          border: '1px solid #CA8A04',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          minHeight: 38,
          textDecoration: 'none',
        }}
      >
        <span>START NOW</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M5 12h14" />
          <path d="M12 5l7 7-7 7" />
        </svg>
      </a>
    </div>
  );
}

// ===================== Social Toast =====================
function SocialToast() {
  const { toastData, show, initials } = useSocialToast();

  return (
    <div className={`social-toast ${show ? 'show' : ''}`}>
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #FEF08A 0%, #EAB308 50%, #CA8A04 100%)',
          color: '#000',
          fontWeight: 900,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.72rem',
          flexShrink: 0,
        }}
      >
        {initials}
      </div>
      <div style={{ fontSize: '0.73rem', color: '#0F172A', lineHeight: 1.3 }}>
        <span dangerouslySetInnerHTML={{ __html: `<strong style="color: #CA8A04;">${toastData.name}</strong> from ${toastData.city} ${toastData.action}` }} />
        <span style={{ fontSize: '0.65rem', color: '#64748B', display: 'block', marginTop: 1 }}>{toastData.time}</span>
      </div>
    </div>
  );
}

// ===================== Submission Form Modal =====================
function SetupModal() {
  const telegramLink = useTelegramLink();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<SetupForm>(initialSetupForm);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  useEffect(() => {
    const openModal = () => {
      setOpen(true);
      setSubmitted(false);
      setSubmitError(false);
      setForm(initialSetupForm);
    };
    window.addEventListener(OPEN_SETUP_EVENT, openModal);
    return () => window.removeEventListener(OPEN_SETUP_EVENT, openModal);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  const update = (field: keyof SetupForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setSubmitError(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(false);

    const { data: ownerId } = await supabase.rpc('get_platform_owner_id');

    let workspaceId: string | null = null;
    if (ownerId) {
      const { data: ws } = await supabase
        .from('workspaces')
        .select('id')
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      workspaceId = ws?.id ?? null;
    }

    const { data: leadData, error } = await supabase.from('submissions').insert({
      full_name: form.fullName,
      mobile_number: form.mobileNumber,
      email: form.email,
      state: form.state,
      trading_product: form.crmProduct,
      fund_amount: null,
      user_id: ownerId ?? null,
      workspace_id: workspaceId,
    }).select('id').single();

    if (error) {
      setSubmitError(true);
      setSubmitting(false);
      return;
    }

    setSubmitted(true);
    setSubmitting(false);
    trackMetaLeadEvent();

    // Fire-and-forget: send auto welcome email if enabled
    if (leadData?.id) {
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-welcome-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: leadData.id,
          fullName: form.fullName,
          email: form.email,
          tradingProduct: form.crmProduct,
          fundAmount: null,
        }),
      }).catch(() => { /* best effort, don't block submission */ });
    }
  };

  const isStarter = form.crmProduct === 'starter';
  const canSubmit = Boolean(form.fullName && form.mobileNumber && form.email && form.state && form.crmProduct);

  return (
    <div className="setup-overlay" role="dialog" aria-modal="true" aria-labelledby="setup-title">
      <div className="setup-modal">
        <button className="setup-close" type="button" onClick={() => setOpen(false)} aria-label="Close form">×</button>
        <div className="setup-heading">
          <div className="setup-heading-icon"><ChartUpIcon /></div>
          <div>
            <h2 id="setup-title">Start Free Trial</h2>
            <p>Fill in your details to get 14-day free CRM access</p>
          </div>
        </div>
        <div className="setup-divider" />

        {submitted ? (
          <div className="setup-success">
            <div className="setup-success-icon">✓</div>
            <h3>Submission received!</h3>
            <p>Thank you! Your free trial request has been received. Check your email for CRM access details and setup instructions.</p>
            <a href={telegramLink} target="_blank" rel="noopener noreferrer" className="setup-primary-button" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Check Your Email for Access</a>
            <button type="button" className="setup-footnote" style={{ background: 'none', border: 'none', cursor: 'pointer', marginTop: 12, color: '#94a3b8' }} onClick={() => setOpen(false)}>Close</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="setup-security-note"><ShieldIcon /><span>Your information is kept private and used only to set up your CRM trial account.</span></div>
            <SetupSection number="1" title="YOUR DETAILS">
              <label>Full Name <em>*</em><input required value={form.fullName} onChange={(e) => update('fullName', e.target.value)} placeholder="Enter your full name" /></label>
              <div className="setup-grid">
                <label>Mobile Number <em>*</em><input required value={form.mobileNumber} onChange={(e) => update('mobileNumber', e.target.value)} placeholder="e.g. +91 98765 43210" inputMode="tel" type="tel" /></label>
                <label>Email ID <em>*</em><input required type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="you@example.com" /></label>
              </div>
              <label>State <em>*</em>
                <select required value={form.state} onChange={(e) => update('state', e.target.value)}>
                  <option value="" disabled>Select your state</option>
                  {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            </SetupSection>
            <SetupSection number="2" title="CHOOSE YOUR CRM PLAN">
              <label>CRM Plan <em>*</em></label>
              <div className="broker-options">
                <button type="button" className={`broker-option ${form.crmProduct === 'starter' ? 'selected' : ''}`} onClick={() => update('crmProduct', 'starter')}>
                  <span />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                    <strong>Starter CRM</strong>
                    <small style={{ fontSize: '0.72rem', fontWeight: 500, color: '#94a3b8' }}>Up to 5 team members</small>
                  </div>
                </button>
                <button type="button" className={`broker-option ${form.crmProduct === 'pro' ? 'selected' : ''}`} onClick={() => update('crmProduct', 'pro')}>
                  <span />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                    <strong>Pro CRM</strong>
                    <small style={{ fontSize: '0.72rem', fontWeight: 500, color: '#94a3b8' }}>Unlimited team &amp; automations</small>
                  </div>
                </button>
              </div>
            </SetupSection>
            {isStarter && (
              <SetupSection number="3" title="TEAM DETAILS">
                <label>Team Size <em>*</em></label>
                <div className="broker-options">
                  <button type="button" className={`broker-option ${form.teamSize === '1-3' ? 'selected' : ''}`} onClick={() => update('teamSize', '1-3')}>
                    <span />
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                      <strong>1-3 Members</strong>
                      <small style={{ fontSize: '0.72rem', fontWeight: 500, color: '#94a3b8' }}>Small sales team</small>
                    </div>
                  </button>
                  <button type="button" className={`broker-option ${form.teamSize === '4-5' ? 'selected' : ''}`} onClick={() => update('teamSize', '4-5')}>
                    <span />
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                      <strong>4-5 Members</strong>
                      <small style={{ fontSize: '0.72rem', fontWeight: 500, color: '#94a3b8' }}>Growing team</small>
                    </div>
                  </button>
                </div>
                <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 8, padding: '10px 12px', marginTop: 8, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#ca8a04', flexShrink: 0, marginTop: 1 }}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <span style={{ fontSize: '0.76rem', color: '#854d0e', lineHeight: 1.4 }}>
                    <strong>Starter CRM</strong> supports up to 5 team members with lead pipeline, follow-up automation, and WhatsApp broadcast.
                  </span>
                </div>
              </SetupSection>
            )}
            {submitError && (
              <p style={{ color: '#ef4444', fontSize: '0.8rem', textAlign: 'center', marginBottom: 10, fontWeight: 600 }}>Something went wrong. Please try again.</p>
            )}
            <button type="submit" className="setup-primary-button" disabled={!canSubmit || submitting}>
              {submitting ? 'Submitting...' : canSubmit ? 'Start My Free Trial' : 'Fill all fields to continue'}
            </button>
            <p className="setup-footnote"><ShieldIcon /> Your data is safe and never shared.</p>
          </form>
        )}
      </div>
    </div>
  );
}

function SetupSection({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return <section className="setup-section"><h3><span>{number}</span>{title}</h3>{children}</section>;
}

function ChartUpIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M3 17 9 11l4 4 8-8" /><path d="M15 7h6v6" /></svg>; }
function ShieldIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3 20 6v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6l8-3Z" /><path d="m8.5 12 2.3 2.3 4.7-4.7" /></svg>; }

// ===================== Landing Page =====================
function LandingPage() {
  useLandingPalette();
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--landing-bg, #F8FAFC)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      <TopUrgencyBar />
      <Header />
      <Hero />
      <StatsBar />
      <ScrollProgressBar />
      <LogoCloud />
      <AwardsStrip />
      <FeatureDeepDive />
      <IntegrationsStrip />
      <ProductCarousel />
      <HowItWorks />
      <Curriculum />
      <OnboardingChecklist />
      <IndustryUseCases />
      <ComparisonTable />
      <CompetitorComparison />
      <BeforeAfter />
      <GiftStack />
      <RoiCalculator />
      <TimeSavingsCalculator />
      <Testimonials />
      <VideoTestimonials />
      <SuccessMetrics />
      <GeographicCoverage />
      <LiveActivityFeed />
      <MobilePreview />
      <TrustGuarantee />
      <CountdownTimer />
      <Pricing />
      <ResourcesPreview />
      <NewsletterCapture />
      <FAQ />
      <FinalCTA />
      <Footer />
      <MobileStickyCTA />
      <SocialToast />
      <HelpWidget />
      <ExitIntentPopup />
      <SetupModal />
      <PopupFormModal />
    </div>
  );
}

export default LandingPage;
