import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { DEFAULT_PALETTE, type LandingPalette } from '@/lib/colorPalette';
import PopupFormModal from '@/components/PopupFormModal';
import CheckoutDrawer from '@/components/CheckoutDrawer';
import {
  Zap, Users, MessageSquare, BarChart3, GitBranch, Shield,
  CheckCircle2, ArrowRight, Sparkles, Phone, Mail, Clock,
  TrendingUp, Target, Bell, FileSpreadsheet, Settings, Star,
  ChevronDown, Menu, X, Workflow, Inbox, Calendar, Award,
} from 'lucide-react';

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
        const d = data as {
          primary_color: string; primary_light: string | null; primary_dark: string | null;
          accent: string | null; accent_dark: string | null; background: string | null;
          surface: string | null; surface_tint: string | null; text: string | null;
          text_muted: string | null; border: string | null; button_bg: string | null;
          button_text: string | null; button_hover: string | null; badge_bg: string | null;
          badge_text: string | null; footer_bg: string | null; footer_text: string | null;
        };
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

function useTelegramLink() {
  const [link, setLink] = useState('#crm-signup');
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

function useCountdown() {
  const [secondsLeft, setSecondsLeft] = useState(14 * 60 + 59);
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 15 * 60));
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const joiners = [
  { name: 'Arjun R.', city: 'Mumbai', action: 'just activated their CRM dashboard!' },
  { name: 'Sneha P.', city: 'Pune', action: 'synced 1,200 leads into LeadFlow!' },
  { name: 'Vikram J.', city: 'Hyderabad', action: 'closed 5 deals this week!' },
  { name: 'Divya K.', city: 'Bengaluru', action: 'launched a WhatsApp broadcast to 3,000 leads!' },
  { name: 'Rohan G.', city: 'Ahmedabad', action: 'set up automated follow-ups!' },
  { name: 'Ananya S.', city: 'Jaipur', action: 'started their 14-day free trial!' },
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
    const initialTimer = setTimeout(showNext, 4000);
    const interval = setInterval(showNext, 12000);
    return () => { clearTimeout(initialTimer); clearInterval(interval); };
  }, []);

  const initials = toastData.name.split(' ').map((n) => n[0]).join('');
  return { toastData, show, initials };
}

function scrollToSignup() {
  window.location.hash = 'signup';
}

// ===================== Nav Bar =====================
function NavBar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navLinks = [
    { label: 'Features', target: 'features' },
    { label: 'How It Works', target: 'how-it-works' },
    { label: 'Pricing', target: 'pricing' },
    { label: 'FAQ', target: 'faq' },
  ];

  const handleNavClick = (target: string) => {
    setMobileOpen(false);
    const el = document.getElementById(target);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <header
      style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: scrolled ? 'rgba(255,255,255,0.92)' : 'transparent',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(16px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(0,0,0,0.06)' : '1px solid transparent',
        transition: 'all 0.3s ease',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="#" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #FEF08A, #EAB308)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(234,179,8,0.3)',
          }}>
            <Zap size={20} strokeWidth={2.5} style={{ color: '#422006' }} />
          </div>
          <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.2rem', color: '#0F172A', letterSpacing: '-0.5px' }}>
            LeadFlow
          </span>
        </a>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 32 }} className="lp-nav-desktop">
          {navLinks.map((link) => (
            <button
              key={link.target}
              onClick={() => handleNavClick(link.target)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, color: '#475569', transition: 'color 0.2s' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#0F172A'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#475569'; }}
            >
              {link.label}
            </button>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }} className="lp-nav-actions">
          <button
            onClick={scrollToSignup}
            style={{
              padding: '9px 22px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #EAB308, #CA8A04)', color: '#fff',
              fontSize: '0.88rem', fontWeight: 700, boxShadow: '0 4px 14px rgba(234,179,8,0.3)',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(234,179,8,0.4)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(234,179,8,0.3)'; }}
          >
            Start Free Trial
          </button>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
            className="lp-nav-toggle"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={24} color="#0F172A" /> : <Menu size={24} color="#0F172A" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div style={{
          background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.08)', padding: '16px 24px',
          display: 'flex', flexDirection: 'column', gap: 12,
        }} className="lp-nav-mobile">
          {navLinks.map((link) => (
            <button
              key={link.target}
              onClick={() => handleNavClick(link.target)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 600, color: '#475569', textAlign: 'left', padding: '8px 0' }}
            >
              {link.label}
            </button>
          ))}
          <button
            onClick={() => { setMobileOpen(false); scrollToSignup(); }}
            style={{
              padding: '10px 22px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #EAB308, #CA8A04)', color: '#fff',
              fontSize: '0.9rem', fontWeight: 700,
            }}
          >
            Start Free Trial
          </button>
        </div>
      )}
    </header>
  );
}

// ===================== Hero =====================
function Hero() {
  return (
    <section style={{ position: 'relative', overflow: 'hidden', paddingTop: 60, paddingBottom: 80 }}>
      {/* Background accents */}
      <div style={{
        position: 'absolute', top: -100, left: -80, width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(234,179,8,0.12), transparent 70%)', filter: 'blur(60px)',
      }} />
      <div style={{
        position: 'absolute', top: 40, right: -100, width: 350, height: 350, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(245,158,11,0.08), transparent 70%)', filter: 'blur(60px)',
      }} />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 24 }}>
          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '7px 18px', borderRadius: 999,
            background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)',
            fontSize: '0.82rem', fontWeight: 700, color: '#854D0E',
          }}>
            <Sparkles size={15} />
            <span>All-in-one CRM for sales teams</span>
          </div>

          {/* Title */}
          <h1 style={{
            fontFamily: 'Outfit, sans-serif', fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 900,
            lineHeight: 1.15, letterSpacing: '-1.5px', color: '#0F172A', maxWidth: 720, margin: 0,
          }}>
            Turn leads into deals,<br />
            <span style={{ background: 'linear-gradient(135deg, #EAB308, #CA8A04)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              on autopilot
            </span>
          </h1>

          {/* Subtitle */}
          <p style={{
            fontSize: 'clamp(1rem, 2vw, 1.15rem)', color: '#475569', lineHeight: 1.6,
            maxWidth: 580, margin: 0,
          }}>
            LeadFlow CRM brings your pipeline, WhatsApp & email campaigns, follow-ups, and team
            collaboration into one clean dashboard. Close more deals with less effort.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
            <button
              onClick={scrollToSignup}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                padding: '14px 32px', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #EAB308, #CA8A04)', color: '#fff',
                fontSize: '1rem', fontWeight: 700, boxShadow: '0 6px 20px rgba(234,179,8,0.35)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 26px rgba(234,179,8,0.45)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(234,179,8,0.35)'; }}
            >
              Start 14-Day Free Trial
              <ArrowRight size={18} />
            </button>
            <span style={{ fontSize: '0.85rem', color: '#94A3B8', fontWeight: 600 }}>
              No credit card required &bull; Set up in 5 minutes
            </span>
          </div>

          {/* Dashboard preview */}
          <HeroDashboardMockup />
        </div>
      </div>
    </section>
  );
}

function HeroDashboardMockup() {
  return (
    <div style={{ marginTop: 20, width: '100%', maxWidth: 820, position: 'relative' }}>
      <div style={{
        background: 'linear-gradient(145deg, #0F172A, #1E293B)',
        borderRadius: 16, padding: 18, border: '1px solid rgba(234,179,8,0.2)',
        boxShadow: '0 20px 60px rgba(15,23,42,0.25), 0 8px 24px rgba(234,179,8,0.08)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Window bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#EF4444' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#F59E0B' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22C55E' }} />
          <div style={{ flex: 1, textAlign: 'center', fontSize: '0.68rem', color: '#64748B', fontWeight: 600, background: 'rgba(255,255,255,0.05)', borderRadius: 6, padding: '4px 10px', border: '1px solid rgba(255,255,255,0.06)' }}>
            app.leadflowcrm.com/pipeline
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          {/* Sidebar */}
          <div style={{
            width: 110, background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 8px',
            display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0,
          }}>
            {[
              { icon: <BarChart3 size={12} />, label: 'Pipeline', active: true },
              { icon: <Users size={12} />, label: 'Leads' },
              { icon: <Inbox size={12} />, label: 'Inbox' },
              { icon: <TrendingUp size={12} />, label: 'Reports' },
              { icon: <Workflow size={12} />, label: 'Auto' },
              { icon: <Settings size={12} />, label: 'Settings' },
            ].map((item) => (
              <div key={item.label} style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '6px 8px', borderRadius: 6,
                fontSize: '0.62rem', fontWeight: 700,
                background: item.active ? 'rgba(234,179,8,0.15)' : 'transparent',
                color: item.active ? '#FACC15' : '#64748B',
              }}>
                {item.icon}
                {item.label}
              </div>
            ))}
          </div>

          {/* Main content */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { label: 'Revenue', val: '\u20B94.2L', color: '#FACC15' },
                { label: 'Win Rate', val: '62%', color: '#22C55E' },
                { label: 'New Leads', val: '847', color: '#38BDF8' },
              ].map((s) => (
                <div key={s.label} style={{
                  background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 10px',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}>
                  <div style={{ fontSize: '0.52rem', color: '#94A3B8', fontWeight: 600, marginBottom: 3 }}>{s.label}</div>
                  <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.88rem', fontWeight: 900, color: s.color }}>{s.val}</div>
                </div>
              ))}
            </div>

            {/* Pipeline columns */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { stage: 'New', count: 12, color: '#38BDF8' },
                { stage: 'Hot', count: 6, color: '#F59E0B' },
                { stage: 'Won', count: 3, color: '#22C55E' },
              ].map((col) => (
                <div key={col.stage} style={{
                  background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 7px',
                  border: '1px solid rgba(255,255,255,0.04)',
                }}>
                  <div style={{ fontSize: '0.55rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: 6, color: col.color }}>
                    {col.stage} ({col.count})
                  </div>
                  {Array.from({ length: Math.min(col.count, 3) }).map((_, i) => (
                    <div key={i} style={{
                      background: 'rgba(255,255,255,0.06)', borderRadius: 5, padding: '5px 6px',
                      marginBottom: 4, border: '1px solid rgba(255,255,255,0.03)',
                    }}>
                      <div style={{ height: 4, width: '70%', borderRadius: 2, background: 'rgba(255,255,255,0.15)', marginBottom: 3 }} />
                      <div style={{ height: 3, width: '50%', borderRadius: 2, background: 'rgba(255,255,255,0.1)' }} />
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Mini bar chart */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 40, padding: '6px 4px 0' }}>
              {[40, 65, 50, 80, 55, 90, 70].map((h, i) => (
                <div key={i} style={{
                  flex: 1, height: `${h}%`, borderRadius: '3px 3px 0 0',
                  background: 'linear-gradient(180deg, #EAB308, #CA8A04)',
                  opacity: i === 5 ? 1 : 0.5,
                }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating card 1 */}
      <div style={{
        position: 'absolute', top: -16, left: -12, zIndex: 3,
        background: '#fff', borderRadius: 12, padding: '10px 14px',
        boxShadow: '0 8px 24px rgba(15,23,42,0.12)', border: '1px solid rgba(234,179,8,0.2)',
        animation: 'hero-float-card 5s ease-in-out infinite',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #DCFCE8, #22C55E)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={15} color="#fff" />
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#1E293B' }}>Deal Closed!</div>
            <div style={{ fontSize: '0.58rem', color: '#64748B', fontWeight: 600 }}>+\u20B985,000</div>
          </div>
        </div>
      </div>

      {/* Floating card 2 */}
      <div style={{
        position: 'absolute', bottom: -14, right: -8, zIndex: 3,
        background: '#fff', borderRadius: 12, padding: '10px 14px',
        boxShadow: '0 8px 24px rgba(15,23,42,0.12)', border: '1px solid rgba(234,179,8,0.2)',
        animation: 'hero-float-card-2 6s ease-in-out infinite',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #FEF08A, #EAB308)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MessageSquare size={14} color="#422006" />
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#1E293B' }}>2,847 leads reached</div>
            <div style={{ fontSize: '0.58rem', color: '#64748B', fontWeight: 600 }}>WhatsApp broadcast</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===================== Logo Strip =====================
function LogoStrip() {
  const logos = ['Sharma Properties', 'Patel Insurance', 'EduFirst Academy', 'FinEdge Capital', 'CarePlus Health', 'ShopSmart D2C'];
  return (
    <section style={{ padding: '32px 24px', borderTop: '1px solid rgba(0,0,0,0.06)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
        <p style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 18 }}>
          Trusted by 5,000+ growing businesses
        </p>
        <div style={{
          display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px 28px',
        }}>
          {logos.map((name) => (
            <span key={name} style={{
              fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', fontWeight: 700,
              color: '#94A3B8', whiteSpace: 'nowrap',
            }}>
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===================== Features =====================
function Features() {
  const features = [
    {
      icon: <BarChart3 size={24} />, title: 'Pipeline Management',
      desc: 'Drag-and-drop deals across custom stages. See exactly where every lead stands and what needs attention next.',
    },
    {
      icon: <MessageSquare size={24} />, title: 'WhatsApp & Email Broadcast',
      desc: 'Send personalized bulk WhatsApp messages and email campaigns to thousands of leads in one click.',
    },
    {
      icon: <Workflow size={24} />, title: 'Automated Follow-ups',
      desc: 'Set up smart sequences that automatically nudge leads at the right time. Never let a deal go cold.',
    },
    {
      icon: <Users size={24} />, title: 'Team Collaboration',
      desc: 'Assign leads to reps, set roles and permissions, and track team performance from one dashboard.',
    },
    {
      icon: <TrendingUp size={24} />, title: 'Analytics & Reports',
      desc: 'Real-time dashboards showing revenue, conversion rates, win/loss analysis, and team leaderboards.',
    },
    {
      icon: <Inbox size={24} />, title: 'Unified Inbox',
      desc: 'All your WhatsApp and email conversations in one place. Reply instantly without switching apps.',
    },
    {
      icon: <Target size={24} />, title: 'Lead Scoring',
      desc: 'Automatically rank leads by engagement and deal value. Focus your energy on the hottest prospects.',
    },
    {
      icon: <FileSpreadsheet size={24} />, title: 'Import & Export',
      desc: 'Bulk import leads via CSV or Google Sheets. Export reports with a single click. No data lock-in.',
    },
    {
      icon: <GitBranch size={24} />, title: 'Automation Builder',
      desc: 'Create custom workflows with triggers and conditions. If a lead does X, automatically do Y.',
    },
  ];

  return (
    <section id="features" style={{ padding: '80px 24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 16px', borderRadius: 999,
            background: 'rgba(234,179,8,0.1)', fontSize: '0.78rem', fontWeight: 700, color: '#854D0E', marginBottom: 16,
          }}>
            <Zap size={14} /> Features
          </span>
          <h2 style={{
            fontFamily: 'Outfit, sans-serif', fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)', fontWeight: 900,
            color: '#0F172A', letterSpacing: '-1px', marginBottom: 12,
          }}>
            Everything you need to close deals faster
          </h2>
          <p style={{ fontSize: '1rem', color: '#475569', maxWidth: 540, margin: '0 auto', lineHeight: 1.6 }}>
            One CRM that replaces your spreadsheets, messaging tools, and follow-up reminders.
          </p>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20,
        }}>
          {features.map((f) => (
            <div key={f.title} style={{
              background: '#fff', borderRadius: 14, padding: 24,
              border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
              transition: 'transform 0.25s, box-shadow 0.25s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.08)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.03)'; }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: 'linear-gradient(135deg, rgba(234,179,8,0.12), rgba(234,179,8,0.05))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#CA8A04', marginBottom: 16,
              }}>
                {f.icon}
              </div>
              <h3 style={{
                fontFamily: 'Outfit, sans-serif', fontSize: '1.05rem', fontWeight: 800,
                color: '#0F172A', marginBottom: 8,
              }}>
                {f.title}
              </h3>
              <p style={{ fontSize: '0.88rem', color: '#475569', lineHeight: 1.6, margin: 0 }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===================== How It Works =====================
function HowItWorks() {
  const steps = [
    {
      num: '01', icon: <FileSpreadsheet size={22} />, title: 'Import Your Leads',
      desc: 'Upload a CSV, sync Google Sheets, or connect your Meta Lead Forms. All your contacts land in one organized dashboard instantly.',
    },
    {
      num: '02', icon: <GitBranch size={22} />, title: 'Build Your Pipeline',
      desc: 'Create custom stages that match your sales process. Drag deals across columns as they progress. Assign leads to team members automatically.',
    },
    {
      num: '03', icon: <MessageSquare size={22} />, title: 'Engage & Broadcast',
      desc: 'Send WhatsApp blasts and email campaigns. Reply from the unified inbox. Set up automated follow-up sequences so no lead goes cold.',
    },
    {
      num: '04', icon: <TrendingUp size={22} />, title: 'Track & Close',
      desc: 'Watch real-time analytics, monitor team performance, and see which campaigns drive revenue. Close deals faster with data-backed decisions.',
    },
  ];

  return (
    <section id="how-it-works" style={{ padding: '80px 24px', background: '#F8FAFC' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 16px', borderRadius: 999,
            background: 'rgba(234,179,8,0.1)', fontSize: '0.78rem', fontWeight: 700, color: '#854D0E', marginBottom: 16,
          }}>
            <Workflow size={14} /> How It Works
          </span>
          <h2 style={{
            fontFamily: 'Outfit, sans-serif', fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)', fontWeight: 900,
            color: '#0F172A', letterSpacing: '-1px', marginBottom: 12,
          }}>
            From lead to deal in 4 simple steps
          </h2>
          <p style={{ fontSize: '1rem', color: '#475569', maxWidth: 500, margin: '0 auto', lineHeight: 1.6 }}>
            Get your entire sales workflow running in under 5 minutes. No technical setup required.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 24 }}>
          {steps.map((step, i) => (
            <div key={step.num} style={{ position: 'relative' }}>
              {i < steps.length - 1 && (
                <div style={{
                  position: 'absolute', top: 32, left: 'calc(100% - 12px)', width: '24px', height: 2,
                  background: 'rgba(234,179,8,0.3)', zIndex: 0,
                }} className="lp-step-connector" />
              )}
              <div style={{
                background: '#fff', borderRadius: 14, padding: 24, height: '100%',
                border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                position: 'relative', zIndex: 1,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 11,
                    background: 'linear-gradient(135deg, #FEF08A, #EAB308)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#422006',
                  }}>
                    {step.icon}
                  </div>
                  <span style={{
                    fontFamily: 'Outfit, sans-serif', fontSize: '1.6rem', fontWeight: 900,
                    color: 'rgba(234,179,8,0.25)',
                  }}>
                    {step.num}
                  </span>
                </div>
                <h3 style={{
                  fontFamily: 'Outfit, sans-serif', fontSize: '1rem', fontWeight: 800,
                  color: '#0F172A', marginBottom: 8,
                }}>
                  {step.title}
                </h3>
                <p style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.6, margin: 0 }}>
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===================== CRM Features Detail =====================
function CRMShowcase() {
  const [active, setActive] = useState(0);

  const tabs = [
    {
      title: 'Pipeline & Lead Management',
      icon: <BarChart3 size={20} />,
      points: [
        'Custom pipeline stages that match your exact sales process',
        'Drag-and-drop deals across stages with instant status updates',
        'Auto-assign leads to the right rep based on rules you set',
        'Lead scoring that ranks prospects by engagement and value',
        'Custom fields to track whatever data matters to your business',
      ],
    },
    {
      title: 'WhatsApp & Email Campaigns',
      icon: <MessageSquare size={20} />,
      points: [
        'Bulk WhatsApp broadcasts to thousands of leads in one click',
        'Email campaigns with templates, scheduling, and open tracking',
        'Unified inbox for all WhatsApp and email conversations',
        'Personalized merge fields for each recipient',
        'Campaign analytics showing delivery, open, and reply rates',
      ],
    },
    {
      title: 'Automations & Follow-ups',
      icon: <Workflow size={20} />,
      points: [
        'Visual automation builder with triggers, conditions, and actions',
        'Scheduled follow-up sequences that run on autopilot',
        'Auto-send WhatsApp or email when a lead enters a stage',
        'Reminders for reps when a deal hasn\'t been touched in X days',
        'Drip campaigns that nurture leads over weeks',
      ],
    },
    {
      title: 'Analytics & Team Tools',
      icon: <TrendingUp size={20} />,
      points: [
        'Revenue dashboard with deal value tracking and forecasting',
        'Win/loss analysis to understand what drives conversions',
        'Agent leaderboard ranking reps by deals closed and revenue',
        'Goal tracking with progress bars for individual and team targets',
        'Role-based permissions controlling who sees and edits what',
      ],
    },
  ];

  const tab = tabs[active];

  return (
    <section style={{ padding: '80px 24px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 16px', borderRadius: 999,
            background: 'rgba(234,179,8,0.1)', fontSize: '0.78rem', fontWeight: 700, color: '#854D0E', marginBottom: 16,
          }}>
            <Award size={14} /> Deep Dive
          </span>
          <h2 style={{
            fontFamily: 'Outfit, sans-serif', fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)', fontWeight: 900,
            color: '#0F172A', letterSpacing: '-1px', marginBottom: 12,
          }}>
            Built for every stage of your sales process
          </h2>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 32,
        }}>
          {tabs.map((t, i) => (
            <button
              key={t.title}
              onClick={() => setActive(i)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10,
                border: i === active ? '1px solid rgba(234,179,8,0.4)' : '1px solid rgba(0,0,0,0.08)',
                background: i === active ? 'rgba(234,179,8,0.08)' : '#fff',
                color: i === active ? '#854D0E' : '#475569',
                fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {t.icon}
              {t.title}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'center',
        }} className="lp-showcase-grid">
          <div>
            <h3 style={{
              fontFamily: 'Outfit, sans-serif', fontSize: '1.3rem', fontWeight: 800,
              color: '#0F172A', marginBottom: 16,
            }}>
              {tab.title}
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {tab.points.map((point) => (
                <li key={point} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <CheckCircle2 size={20} style={{ color: '#22C55E', flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontSize: '0.9rem', color: '#475569', lineHeight: 1.5 }}>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Visual panel */}
          <div style={{
            background: 'linear-gradient(145deg, #0F172A, #1E293B)',
            borderRadius: 16, padding: 24, border: '1px solid rgba(234,179,8,0.2)',
            minHeight: 280,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {tab.points.slice(0, 4).map((p, i) => (
                <div key={i} style={{
                  background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '12px 14px',
                  border: '1px solid rgba(255,255,255,0.05)',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: 'rgba(234,179,8,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {tab.icon && <span style={{ color: '#FACC15' }}>{tab.icon}</span>}
                  </div>
                  <span style={{ fontSize: '0.78rem', color: '#CBD5E1', fontWeight: 600 }}>
                    {p.length > 60 ? p.slice(0, 60) + '...' : p}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ===================== Stats =====================
function StatsBar() {
  const stats = [
    { value: '5,000+', label: 'Businesses onboard' },
    { value: '2.5Cr+', label: 'Revenue tracked' },
    { value: '50L+', label: 'Leads managed' },
    { value: '62%', label: 'Avg. win rate' },
  ];
  return (
    <section style={{ padding: '48px 24px', background: '#0F172A' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 24 }}>
        {stats.map((s) => (
          <div key={s.label} style={{ textAlign: 'center' }}>
            <div style={{
              fontFamily: 'Outfit, sans-serif', fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 900,
              background: 'linear-gradient(135deg, #FEF08A, #EAB308)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              lineHeight: 1.1, marginBottom: 6,
            }}>
              {s.value}
            </div>
            <div style={{ fontSize: '0.82rem', color: '#94A3B8', fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ===================== Pricing =====================
function Pricing() {
  const plans = [
    {
      name: 'Starter', price: '\u20B9999', period: '/month',
      desc: 'For solo reps and small teams getting started',
      features: ['Up to 1,000 leads', '1 WhatsApp number', 'Email campaigns', 'Pipeline management', 'Basic analytics', '1 user seat'],
      cta: 'Start Free Trial', highlighted: false,
    },
    {
      name: 'Growth', price: '\u20B92,999', period: '/month',
      desc: 'For growing teams that need automation',
      features: ['Up to 10,000 leads', '3 WhatsApp numbers', 'Email + WhatsApp broadcast', 'Automation builder', 'Advanced analytics', '5 user seats', 'Lead scoring', 'Unified inbox'],
      cta: 'Start Free Trial', highlighted: true,
    },
    {
      name: 'Scale', price: '\u20B95,999', period: '/month',
      desc: 'For large teams with complex workflows',
      features: ['Unlimited leads', 'Unlimited WhatsApp numbers', 'All broadcast channels', 'Custom automations', 'Revenue forecasting', 'Unlimited users', 'Win/loss analysis', 'Priority support'],
      cta: 'Start Free Trial', highlighted: false,
    },
  ];

  return (
    <section id="pricing" style={{ padding: '80px 24px', background: '#F8FAFC' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 16px', borderRadius: 999,
            background: 'rgba(234,179,8,0.1)', fontSize: '0.78rem', fontWeight: 700, color: '#854D0E', marginBottom: 16,
          }}>
            <Star size={14} /> Pricing
          </span>
          <h2 style={{
            fontFamily: 'Outfit, sans-serif', fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)', fontWeight: 900,
            color: '#0F172A', letterSpacing: '-1px', marginBottom: 12,
          }}>
            Simple, transparent pricing
          </h2>
          <p style={{ fontSize: '1rem', color: '#475569', maxWidth: 500, margin: '0 auto', lineHeight: 1.6 }}>
            Start with a 14-day free trial. No credit card required. Cancel anytime.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
          {plans.map((plan) => (
            <div key={plan.name} style={{
              background: '#fff', borderRadius: 16, padding: 28,
              border: plan.highlighted ? '2px solid #EAB308' : '1px solid rgba(0,0,0,0.06)',
              boxShadow: plan.highlighted ? '0 8px 30px rgba(234,179,8,0.12)' : '0 2px 8px rgba(0,0,0,0.03)',
              position: 'relative', transition: 'transform 0.25s, box-shadow 0.25s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              {plan.highlighted && (
                <div style={{
                  position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                  padding: '4px 14px', borderRadius: 999,
                  background: 'linear-gradient(135deg, #EAB308, #CA8A04)', color: '#fff',
                  fontSize: '0.72rem', fontWeight: 800, whiteSpace: 'nowrap',
                }}>
                  MOST POPULAR
                </div>
              )}
              <h3 style={{
                fontFamily: 'Outfit, sans-serif', fontSize: '1.15rem', fontWeight: 800,
                color: '#0F172A', marginBottom: 6,
              }}>
                {plan.name}
              </h3>
              <p style={{ fontSize: '0.82rem', color: '#94A3B8', marginBottom: 16, lineHeight: 1.5, minHeight: 38 }}>
                {plan.desc}
              </p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 20 }}>
                <span style={{
                  fontFamily: 'Outfit, sans-serif', fontSize: '2rem', fontWeight: 900, color: '#0F172A',
                }}>
                  {plan.price}
                </span>
                <span style={{ fontSize: '0.85rem', color: '#94A3B8', fontWeight: 600 }}>{plan.period}</span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {plan.features.map((feat) => (
                  <li key={feat} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CheckCircle2 size={16} style={{ color: '#22C55E', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.85rem', color: '#475569' }}>{feat}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={scrollToSignup}
                style={{
                  width: '100%', padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: plan.highlighted ? 'linear-gradient(135deg, #EAB308, #CA8A04)' : 'rgba(0,0,0,0.05)',
                  color: plan.highlighted ? '#fff' : '#0F172A',
                  fontSize: '0.9rem', fontWeight: 700,
                  transition: 'transform 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===================== Testimonials =====================
function Testimonials() {
  const reviews = [
    {
      quote: 'Our agents close 40% more deals since switching to LeadFlow. The pipeline view alone is worth it.',
      name: 'Vikram Sharma', role: 'Sales Director, Sharma Real Estate', rating: 5,
    },
    {
      quote: 'WhatsApp broadcast replaced 10 hours of manual messaging every week. Game changer for our team.',
      name: 'Ananya Patel', role: 'Operations Head, Patel Insurance', rating: 5,
    },
    {
      quote: 'Auto-assignment cut our lead response time from 2 hours to 15 minutes. Enrollment tripled.',
      name: 'Rajesh Kumar', role: 'Admissions Lead, EduFirst Academy', rating: 5,
    },
  ];

  return (
    <section style={{ padding: '80px 24px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 16px', borderRadius: 999,
            background: 'rgba(234,179,8,0.1)', fontSize: '0.78rem', fontWeight: 700, color: '#854D0E', marginBottom: 16,
          }}>
            <Star size={14} /> Testimonials
          </span>
          <h2 style={{
            fontFamily: 'Outfit, sans-serif', fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)', fontWeight: 900,
            color: '#0F172A', letterSpacing: '-1px', marginBottom: 12,
          }}>
            Loved by sales teams across India
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
          {reviews.map((r) => (
            <div key={r.name} style={{
              background: '#fff', borderRadius: 14, padding: 24,
              border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            }}>
              <div style={{ display: 'flex', gap: 2, marginBottom: 14 }}>
                {Array.from({ length: r.rating }).map((_, i) => (
                  <Star key={i} size={16} fill="#EAB308" color="#EAB308" />
                ))}
              </div>
              <p style={{
                fontSize: '0.9rem', color: '#334155', lineHeight: 1.6, marginBottom: 18, fontStyle: 'italic',
              }}>
                "{r.quote}"
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #FEF08A, #EAB308)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.82rem', fontWeight: 900, color: '#422006',
                }}>
                  {r.name.split(' ').map((w) => w[0]).join('')}
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0F172A' }}>{r.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{r.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===================== FAQ =====================
function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  const faqs = [
    {
      q: 'How is LeadFlow CRM different from other CRMs?',
      a: 'LeadFlow is built specifically for Indian sales teams. It combines pipeline management, WhatsApp and email broadcasting, automated follow-ups, and team collaboration in one simple tool. No expensive add-ons, no complex setup.',
    },
    {
      q: 'Do I need a credit card to start the free trial?',
      a: 'No. The 14-day free trial requires zero payment information. You get full access to all features. Add your payment details only when you decide to continue.',
    },
    {
      q: 'Can I import my existing leads?',
      a: 'Yes. You can bulk import leads via CSV upload or sync from Google Sheets. If you run Meta lead ads, we can auto-import leads from your Facebook forms in real-time.',
    },
    {
      q: 'Does it support WhatsApp bulk messaging?',
      a: 'Absolutely. Connect your WhatsApp Business number and send personalized broadcasts to thousands of leads at once. You can also use the unified inbox to reply to individual conversations.',
    },
    {
      q: 'How many team members can I add?',
      a: 'It depends on your plan. Starter includes 1 seat, Growth includes 5, and Scale offers unlimited users. You can assign roles and permissions to control who sees what.',
    },
    {
      q: 'Is my data secure?',
      a: 'All data is encrypted and stored securely. We use row-level security so each workspace only sees its own data. We never share or sell your information.',
    },
  ];

  return (
    <section id="faq" style={{ padding: '80px 24px', background: '#F8FAFC' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 16px', borderRadius: 999,
            background: 'rgba(234,179,8,0.1)', fontSize: '0.78rem', fontWeight: 700, color: '#854D0E', marginBottom: 16,
          }}>
            <Bell size={14} /> FAQ
          </span>
          <h2 style={{
            fontFamily: 'Outfit, sans-serif', fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)', fontWeight: 900,
            color: '#0F172A', letterSpacing: '-1px',
          }}>
            Frequently asked questions
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {faqs.map((faq, i) => (
            <div key={i} style={{
              background: '#fff', borderRadius: 12, overflow: 'hidden',
              border: '1px solid rgba(0,0,0,0.06)',
            }}>
              <button
                onClick={() => setOpen(open === i ? null : i)}
                style={{
                  width: '100%', padding: '16px 20px', background: 'none', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer', textAlign: 'left',
                  fontSize: '0.92rem', fontWeight: 700, color: '#0F172A',
                }}
              >
                {faq.q}
                <ChevronDown
                  size={18}
                  color="#94A3B8"
                  style={{
                    transform: open === i ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.25s', flexShrink: 0,
                  }}
                />
              </button>
              {open === i && (
                <div style={{ padding: '0 20px 16px 20px', fontSize: '0.88rem', color: '#475569', lineHeight: 1.6 }}>
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===================== Final CTA =====================
function FinalCTA() {
  const countdown = useCountdown();

  return (
    <section style={{ padding: '80px 24px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{
          background: 'linear-gradient(135deg, #0F172A, #1E293B)',
          borderRadius: 24, padding: '48px 32px', textAlign: 'center',
          border: '1px solid rgba(234,179,8,0.25)',
          boxShadow: '0 20px 60px rgba(15,23,42,0.2)',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: -50, left: -30, width: 200, height: 200, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(234,179,8,0.15), transparent 70%)', filter: 'blur(40px)',
          }} />
          <div style={{ position: 'relative', zIndex: 2 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 16px', borderRadius: 999,
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
              fontSize: '0.75rem', fontWeight: 800, color: '#FCA5A5', marginBottom: 20,
            }}>
              <Clock size={13} /> Trial ends in {countdown}
            </span>
            <h2 style={{
              fontFamily: 'Outfit, sans-serif', fontSize: 'clamp(1.5rem, 4vw, 2.2rem)', fontWeight: 900,
              color: '#fff', letterSpacing: '-1px', marginBottom: 14,
            }}>
              Ready to close more deals?
            </h2>
            <p style={{
              fontSize: '1rem', color: '#94A3B8', lineHeight: 1.6, maxWidth: 460, margin: '0 auto 28px',
            }}>
              Join 5,000+ teams using LeadFlow to manage leads, automate follow-ups, and track revenue.
              Your free trial starts in 5 minutes.
            </p>
            <button
              onClick={scrollToSignup}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                padding: '15px 36px', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #EAB308, #CA8A04)', color: '#fff',
                fontSize: '1.05rem', fontWeight: 700, boxShadow: '0 6px 20px rgba(234,179,8,0.35)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 26px rgba(234,179,8,0.45)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(234,179,8,0.35)'; }}
            >
              Start Your Free Trial
              <ArrowRight size={18} />
            </button>
            <p style={{ fontSize: '0.8rem', color: '#64748B', marginTop: 16, fontWeight: 600 }}>
              No credit card needed &bull; Cancel anytime
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ===================== Footer =====================
function Footer() {
  const telegramLink = useTelegramLink();

  return (
    <footer style={{ background: '#0F172A', padding: '48px 24px 24px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 32, marginBottom: 32,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'linear-gradient(135deg, #FEF08A, #EAB308)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Zap size={18} strokeWidth={2.5} color="#422006" />
              </div>
              <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.1rem', color: '#fff' }}>
                LeadFlow
              </span>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#64748B', lineHeight: 1.6, maxWidth: 240 }}>
              The all-in-one CRM for sales teams. Manage leads, automate follow-ups, and close deals faster.
            </p>
          </div>

          <div>
            <h4 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', fontWeight: 800, color: '#fff', marginBottom: 14 }}>
              Product
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {['Features', 'How It Works', 'Pricing', 'FAQ'].map((l) => (
                <li key={l}>
                  <button onClick={() => {
                    const el = document.getElementById(l.toLowerCase().replace(/\s/g, '-'));
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }} style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    fontSize: '0.82rem', color: '#64748B', textAlign: 'left',
                  }}>
                    {l}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', fontWeight: 800, color: '#fff', marginBottom: 14 }}>
              Company
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'About', hash: 'about' },
                { label: 'Privacy Policy', hash: 'privacy' },
                { label: 'Terms of Service', hash: 'terms' },
                { label: 'Contact', hash: 'signup' },
              ].map((l) => (
                <li key={l.label}>
                  <a href={`#${l.hash}`} style={{ fontSize: '0.82rem', color: '#64748B', textDecoration: 'none' }}>
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', fontWeight: 800, color: '#fff', marginBottom: 14 }}>
              Get Started
            </h4>
            <button
              onClick={scrollToSignup}
              style={{
                padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #EAB308, #CA8A04)', color: '#fff',
                fontSize: '0.85rem', fontWeight: 700, marginBottom: 10,
              }}
            >
              Start Free Trial
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: '#64748B' }}>
                <Mail size={14} /> support@leadflowcrm.com
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: '#64748B' }}>
                <Phone size={14} /> +91 98765 43210
              </span>
            </div>
          </div>
        </div>

        <div style={{
          paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
        }}>
          <p style={{ fontSize: '0.78rem', color: '#64748B' }}>
            &copy; {new Date().getFullYear()} LeadFlow CRM. All rights reserved.
          </p>
          <div style={{ display: 'flex', gap: 16 }}>
            <a href="#privacy" style={{ fontSize: '0.78rem', color: '#64748B', textDecoration: 'none' }}>Privacy</a>
            <a href="#terms" style={{ fontSize: '0.78rem', color: '#64748B', textDecoration: 'none' }}>Terms</a>
            <a href={telegramLink} style={{ fontSize: '0.78rem', color: '#64748B', textDecoration: 'none' }}>Telegram</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ===================== Mobile Sticky CTA =====================
function MobileStickyCTA() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 99,
      background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
      borderTop: '1px solid rgba(0,0,0,0.08)', padding: '12px 16px',
      display: 'none', justifyContent: 'center',
    }} className="lp-mobile-cta">
      <button
        onClick={scrollToSignup}
        style={{
          width: '100%', maxWidth: 400, padding: '13px', borderRadius: 12, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, #EAB308, #CA8A04)', color: '#fff',
          fontSize: '0.95rem', fontWeight: 700, boxShadow: '0 4px 14px rgba(234,179,8,0.3)',
        }}
      >
        Start 14-Day Free Trial
      </button>
    </div>
  );
}

// ===================== Social Toast =====================
function SocialToast() {
  const { toastData, show, initials } = useSocialToast();

  return (
    <div
      className={`social-toast ${show ? 'show' : ''}`}
      style={{
        position: 'fixed', bottom: 24, left: 24, zIndex: 90,
        background: '#fff', borderRadius: 12, padding: '12px 16px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)', border: '1px solid rgba(0,0,0,0.06)',
        display: show ? 'flex' : 'none', alignItems: 'center', gap: 10,
        maxWidth: 320, transition: 'opacity 0.3s, transform 0.3s',
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: 'linear-gradient(135deg, #FEF08A, #EAB308)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.72rem', fontWeight: 900, color: '#422006', flexShrink: 0,
      }}>
        {initials}
      </div>
      <div style={{ fontSize: '0.73rem', color: '#334155', lineHeight: 1.4 }}>
        <strong style={{ color: '#854D0E' }}>{toastData.name}</strong> from {toastData.city} {toastData.action}
      </div>
    </div>
  );
}

// ===================== Landing Page =====================
function LandingPage() {
  useLandingPalette();

  useEffect(() => {
    const onHashChange = () => {
      const h = window.location.hash.replace(/^#\/?/, '');
      if (h === 'signup') {
        window.dispatchEvent(new Event('open-mt5-setup'));
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    };
    onHashChange();
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--landing-bg, #FFFFFF)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      <NavBar />
      <Hero />
      <LogoStrip />
      <Features />
      <HowItWorks />
      <CRMShowcase />
      <StatsBar />
      <Pricing />
      <Testimonials />
      <FAQ />
      <FinalCTA />
      <Footer />
      <MobileStickyCTA />
      <SocialToast />
      <CheckoutDrawer />
      <PopupFormModal />
    </div>
  );
}

export default LandingPage;
