import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import LandingPage from './LandingPage';
import CrmLogin from './components/CrmLogin';
import CrmDashboard from './components/CrmDashboard';
import SuperAdminLogin from './components/SuperAdminLogin';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import { AboutPage, PrivacyPage, TermsPage, CareersPage, SecurityPage, BrandAssetsPage, ReportAbusePage, SitemapPage } from './components/InfoPages';
import LegalPageView from './components/LegalPageView';
import { Shield, X } from 'lucide-react';

function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash.slice(1));

  useEffect(() => {
    const onChange = () => setHash(window.location.hash.slice(1));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return hash;
}

function useImpersonationBanner(session: Session | null) {
  const [impersonationAdminEmail, setImpersonationAdminEmail] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem('impersonation_admin_session');
    if (raw && session) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.admin_email && parsed.access_token !== session.access_token) {
          setImpersonationAdminEmail(parsed.admin_email);
        } else {
          setImpersonationAdminEmail(null);
        }
      } catch {
        setImpersonationAdminEmail(null);
      }
    } else {
      setImpersonationAdminEmail(null);
    }
  }, [session]);

  const exitImpersonation = async () => {
    const raw = localStorage.getItem('impersonation_admin_session');
    if (!raw) {
      await supabase.auth.signOut();
      window.location.hash = '#/superadmin';
      return;
    }

    try {
      const adminSession = JSON.parse(raw);

      // Notify the edge function to end the impersonation log
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/impersonate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminSession.access_token}`,
        },
        body: JSON.stringify({ action: 'end' }),
      }).catch(() => {});

      // Restore the admin session
      await supabase.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token,
      });

      localStorage.removeItem('impersonation_admin_session');
      setImpersonationAdminEmail(null);
      window.location.hash = '#/superadmin';
    } catch {
      localStorage.removeItem('impersonation_admin_session');
      await supabase.auth.signOut();
      window.location.hash = '#/superadmin';
    }
  };

  return { impersonationAdminEmail, exitImpersonation };
}

function ImpersonationBanner({ adminEmail, onExit }: { adminEmail: string; onExit: () => void }) {
  return (
    <div style={{
      background: 'linear-gradient(90deg, #92400e, #b45309)',
      padding: '10px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      color: 'var(--bg-card)',
      fontSize: '0.82rem',
      fontWeight: 600,
    }}>
      <Shield size={16} />
      <span>
        You are logged in as a customer. Admin session: {adminEmail}
      </span>
      <button
        type="button"
        onClick={onExit}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          padding: '5px 14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.3)',
          background: 'rgba(255,255,255,0.15)', color: 'var(--bg-card)',
          fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        <X size={13} /> Exit Impersonation
      </button>
    </div>
  );
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [superAdminChecked, setSuperAdminChecked] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const hash = useHashRoute();

  const { impersonationAdminEmail, exitImpersonation } = useImpersonationBanner(session);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthChecked(true);
      if (data.session?.access_token) {
        supabase.realtime.setAuth(data.session.access_token);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setSuperAdminChecked(false);
      setIsSuperAdmin(false);
      if (sess?.access_token) {
        supabase.realtime.setAuth(sess.access_token);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // Check super admin status when on superadmin route
  useEffect(() => {
    if (hash !== 'superadmin' && hash !== '/superadmin') return;
    if (!session) {
      setSuperAdminChecked(true);
      return;
    }

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc('is_super_admin');
      if (cancelled) return;
      if (!error && data === true) {
        setIsSuperAdmin(true);
      } else {
        setIsSuperAdmin(false);
      }
      setSuperAdminChecked(true);
    })();
    return () => { cancelled = true; };
  }, [hash, session]);

  // If impersonating, inject banner above the CRM dashboard
  const showImpersonationBanner = !!impersonationAdminEmail && (hash === 'admin' || hash === '/admin' || hash === 'signup' || hash === '/signup');

  // Landing page for root hash
  if (hash === '' || hash === '/' || hash === '#') {
    return <LandingPage />;
  }

  // Info pages
  if (hash === 'about' || hash === '/about') return <AboutPage />;
  if (hash === 'privacy' || hash === '/privacy') return <PrivacyPage />;
  if (hash === 'terms' || hash === '/terms') return <TermsPage />;
  if (hash === 'careers' || hash === '/careers') return <CareersPage />;
  if (hash === 'security' || hash === '/security') return <SecurityPage />;
  if (hash === 'brand-assets' || hash === '/brand-assets') return <BrandAssetsPage />;
  if (hash === 'report-abuse' || hash === '/report-abuse') return <ReportAbusePage />;
  if (hash === 'sitemap' || hash === '/sitemap') return <SitemapPage />;

  // Dynamic legal pages: #/legal/terms, #/legal/privacy, etc.
  if (hash.startsWith('legal/') || hash.startsWith('/legal/')) {
    const slug = hash.replace(/^\/?legal\//, '');
    return <LegalPageView slug={slug} />;
  }

  // Super admin route: #/superadmin
  if (hash === 'superadmin' || hash === '/superadmin') {
    if (!authChecked || (session && !superAdminChecked)) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f172a, #1e293b)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#0f766e', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            <div style={{ color: '#94a3b8', fontSize: '0.88rem' }}>Loading...</div>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      );
    }

    if (!session) {
      return <SuperAdminLogin />;
    }

    if (!isSuperAdmin) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f172a, #1e293b)', padding: '20px' }}>
          <div style={{ textAlign: 'center', maxWidth: '420px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'rgba(239,68,68,0.15)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '1.5rem' }}>&#9888;</span>
            </div>
            <h1 style={{ color: 'var(--bg-card)', fontSize: '1.3rem', fontWeight: 700, marginBottom: '10px' }}>Not Authorized</h1>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.88rem', marginBottom: '20px' }}>
              You are signed in but not authorized as a super admin. Contact the platform owner to be granted access.
            </p>
            <button
              type="button"
              onClick={async () => { await supabase.auth.signOut(); }}
              style={{
                padding: '10px 20px', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px',
                background: 'rgba(255,255,255,0.1)', color: 'var(--bg-card)', fontSize: '0.85rem',
                fontWeight: 600, cursor: 'pointer',
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      );
    }

    return (
      <SuperAdminDashboard
        session={session}
        onSignOut={async () => { await supabase.auth.signOut(); }}
      />
    );
  }

  // CRM admin route: #/admin
  if (hash === 'admin' || hash === '/admin') {
    if (!authChecked) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-light)' }}>
          <div style={{ color: '#475569', fontSize: '0.9rem' }}>Loading...</div>
        </div>
      );
    }

    if (!session) {
      return <CrmLogin />;
    }

    return (
      <>
        {showImpersonationBanner && (
          <ImpersonationBanner adminEmail={impersonationAdminEmail!} onExit={exitImpersonation} />
        )}
        <CrmDashboard session={session} />
      </>
    );
  }

  // CRM signup route: #/signup
  if (hash === 'signup' || hash === '/signup') {
    if (!authChecked) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-light)' }}>
          <div style={{ color: '#475569', fontSize: '0.9rem' }}>Loading...</div>
        </div>
      );
    }

    if (!session) {
      return <CrmLogin initialMode="signup" />;
    }

    return (
      <>
        {showImpersonationBanner && (
          <ImpersonationBanner adminEmail={impersonationAdminEmail!} onExit={exitImpersonation} />
        )}
        <CrmDashboard session={session} />
      </>
    );
  }

  // Unknown hash — fall back to landing
  return <LandingPage />;
}

export default App;
