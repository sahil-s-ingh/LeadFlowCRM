import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, AlertCircle, FileText } from 'lucide-react';

export default function LegalPageView({ slug }: { slug: string }) {
  const [page, setPage] = useState<{ title: string; subtitle: string | null; content: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      const { data, error: err } = await supabase
        .from('legal_pages')
        .select('title, subtitle, content')
        .eq('slug', slug)
        .eq('is_published', true)
        .maybeSingle();
      if (err) { setError(err.message); }
      else if (!data) { setError('Page not found'); }
      else { setPage(data); }
      setLoading(false);
    })();
  }, [slug]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={28} className="crm-spin" style={{ color: '#0f766e' }} />
      </div>
    );
  }

  if (error || !page) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ textAlign: 'center', maxWidth: '420px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'rgba(239,68,68,0.1)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
            <AlertCircle size={28} style={{ color: '#dc2626' }} />
          </div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>Page Not Found</h1>
          <p style={{ color: 'var(--text-dark)', fontSize: '0.88rem', marginBottom: '20px' }}>
            {error || 'The legal page you are looking for does not exist or is not published.'}
          </p>
          <a href="#" onClick={(e) => { e.preventDefault(); window.location.hash = ''; }} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 20px', borderRadius: '8px', background: '#0f766e', color: 'var(--bg-card)', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none' }}>
            Back to Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-light)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, left: 0, width: '100%',
        background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-subtle)', zIndex: 100,
        display: 'flex', alignItems: 'center', height: '58px',
      }}>
        <div style={{ width: '100%', maxWidth: 800, margin: '0 auto', padding: '0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <a href="#" onClick={(e) => { e.preventDefault(); window.location.hash = ''; }} style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: '1.05rem', letterSpacing: '-0.3px', color: 'var(--text-main)', textDecoration: 'none' }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'linear-gradient(135deg, #FEF08A, #EAB308)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '2px solid #EAB308', boxShadow: '0 2px 6px rgba(234,179,8,0.25)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#422006" strokeWidth="2.5"><path d="M3 17l6-6 4 4 8-8" /><path d="M21 7v4h-4" /></svg>
            </div>
            <span>LeadFlow CRM</span>
          </a>
          <a href="#" onClick={(e) => { e.preventDefault(); window.location.hash = ''; }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: 'linear-gradient(180deg, #FACC15, #EAB308)', color: 'var(--text-main)', fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.3px', textDecoration: 'none', border: '1px solid #CA8A04', boxShadow: '0 3px 10px rgba(202,138,4,0.2)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
            Back to Home
          </a>
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 800, margin: '0 auto', padding: '32px 16px 60px' }}>
        <div style={{ marginBottom: 28 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.4)', color: '#854D0E', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>
            <FileText size={12} /> LEGAL
          </span>
          <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.75rem', fontWeight: 900, marginBottom: 8, lineHeight: 1.35, letterSpacing: '-0.2px', color: 'var(--text-main)' }}>{page.title}</h1>
          {page.subtitle && <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>{page.subtitle}</p>}
        </div>
        <div style={{
          background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border-subtle)',
          boxShadow: '0 3px 12px rgba(0,0,0,0.02)', padding: '28px 24px',
          fontSize: '0.9rem', lineHeight: 1.7, color: 'var(--text-muted)',
        }} className="legal-content-render" dangerouslySetInnerHTML={{ __html: page.content }} />
      </main>

      {/* Footer */}
      <footer style={{ background: '#09120F', color: 'var(--text-dark)', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '24px 16px 32px', fontSize: '0.78rem', textAlign: 'center' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <a href="#" onClick={(e) => { e.preventDefault(); window.location.hash = ''; }} style={{ color: 'var(--text-dark)', textDecoration: 'none', fontSize: '0.76rem', fontWeight: 600 }}>&larr; Back to LeadFlow CRM</a>
          <div style={{ marginTop: 8, color: 'var(--text-dark)', fontSize: '0.73rem' }}>&copy; 2026 LeadFlow CRM. All Rights Reserved.</div>
        </div>
      </footer>
    </div>
  );
}
