import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import LandingPage from './LandingPage';
import CrmLogin from './components/CrmLogin';
import CrmDashboard from './components/CrmDashboard';
import SuperAdminLogin from './components/SuperAdminLogin';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import { AboutPage, PrivacyPage, TermsPage, CareersPage, SecurityPage, BrandAssetsPage, ReportAbusePage, SitemapPage } from './components/InfoPages';

function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash.slice(1));

  useEffect(() => {
    const onChange = () => setHash(window.location.hash.slice(1));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return hash;
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [superAdminChecked, setSuperAdminChecked] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const hash = useHashRoute();

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

    (async () => {
      // First try bootstrap — if no super admins exist yet, this promotes the caller
      await supabase.rpc('bootstrap_super_admin');

      // Now check if we're a super admin
      const { data, error } = await supabase.rpc('is_super_admin');
      if (!error && data === true) {
        setIsSuperAdmin(true);
      } else {
        setIsSuperAdmin(false);
      }
      setSuperAdminChecked(true);
    })();
  }, [hash, session]);

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
            <h1 style={{ color: '#fff', fontSize: '1.3rem', fontWeight: 700, marginBottom: '10px' }}>Not Authorized</h1>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.88rem', marginBottom: '20px' }}>
              You are signed in but not authorized as a super admin. Contact the platform owner to be granted access.
            </p>
            <button
              type="button"
              onClick={async () => { await supabase.auth.signOut(); }}
              style={{
                padding: '10px 20px', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px',
                background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.85rem',
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
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC' }}>
          <div style={{ color: '#475569', fontSize: '0.9rem' }}>Loading...</div>
        </div>
      );
    }

    if (!session) {
      return <CrmLogin />;
    }

    return <CrmDashboard session={session} />;
  }

  // CRM signup route: #/signup
  if (hash === 'signup' || hash === '/signup') {
    if (!authChecked) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC' }}>
          <div style={{ color: '#475569', fontSize: '0.9rem' }}>Loading...</div>
        </div>
      );
    }

    if (!session) {
      return <CrmLogin initialMode="signup" />;
    }

    return <CrmDashboard session={session} />;
  }

  // Unknown hash — fall back to landing
  return <LandingPage />;
}

export default App;
