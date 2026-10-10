import { useState } from 'react';

// ===================== Shared Layout =====================
function InfoHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        left: 0,
        width: '100%',
        background: 'rgba(255, 255, 255, 0.94)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        height: '58px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 800, margin: '0 auto', padding: '0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <a href="#" onClick={(e) => { e.preventDefault(); window.location.hash = ''; }} style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: '1.05rem', letterSpacing: '-0.3px', color: '#0F172A', textDecoration: 'none' }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: 'linear-gradient(135deg, #FEF08A, #EAB308)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '2px solid #EAB308', boxShadow: '0 2px 6px rgba(234,179,8,0.25)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#422006" strokeWidth="2.5"><path d="M3 17l6-6 4 4 8-8" /><path d="M21 7v4h-4" /></svg>
          </div>
          <span>LeadFlow CRM</span>
        </a>
        <a href="#" onClick={(e) => { e.preventDefault(); window.location.hash = ''; }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: 'linear-gradient(180deg, #FACC15, #EAB308)', color: '#000', fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.3px', textDecoration: 'none', border: '1px solid #CA8A04', boxShadow: '0 3px 10px rgba(202,138,4,0.2)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
          Back to Home
        </a>
      </div>
    </header>
  );
}

function InfoFooter() {
  const links = [
    { label: 'About Us', hash: 'about' },
    { label: 'Privacy Policy', hash: 'privacy' },
    { label: 'Terms & Conditions', hash: 'terms' },
    { label: 'Careers', hash: 'careers' },
    { label: 'Security', hash: 'security' },
    { label: 'Brand Assets', hash: 'brand-assets' },
    { label: 'Report Abuse', hash: 'report-abuse' },
    { label: 'Sitemap', hash: 'sitemap' },
  ];
  return (
    <footer style={{ background: '#09120F', color: '#94A3B8', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '32px 16px 40px', fontSize: '0.78rem', lineHeight: 1.55, marginTop: 60 }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #FEF08A, #EAB308)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#422006" strokeWidth="2.5"><path d="M3 17l6-6 4 4 8-8" /><path d="M21 7v4h-4" /></svg>
          </div>
          <div>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: '0.92rem', color: '#F1F5F9' }}>LeadFlow CRM</div>
            <div style={{ fontSize: '0.68rem', color: '#64748B' }}>All-in-One Sales & Lead Management Platform</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {links.map((l) => (
            <a key={l.hash} href={`#${l.hash}`} onClick={(e) => { e.preventDefault(); window.location.hash = l.hash; }} style={{ display: 'inline-flex', padding: '5px 11px', borderRadius: 9999, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#94A3B8', fontSize: '0.72rem', fontWeight: 600, textDecoration: 'none', transition: 'all 0.2s' }}>
              {l.label}
            </a>
          ))}
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16, textAlign: 'center', color: '#64748B', fontSize: '0.73rem' }}>
          &copy; 2026 LeadFlow CRM. All Rights Reserved.
        </div>
      </div>
    </footer>
  );
}

function InfoLayout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: 'Plus Jakarta Sans, sans-serif', display: 'flex', flexDirection: 'column' }}>
      <InfoHeader title={title} />
      <main style={{ flex: 1, maxWidth: 800, width: '100%', margin: '0 auto', padding: '32px 16px' }}>
        {children}
      </main>
      <InfoFooter />
    </div>
  );
}

function PageTitle({ pill, title, desc }: { pill: string; title: string; desc?: string }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <span style={{ display: 'inline-block', padding: '3px 10px', background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.4)', color: '#854D0E', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>{pill}</span>
      <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.75rem', fontWeight: 900, marginBottom: 8, lineHeight: 1.35, letterSpacing: '-0.2px', color: '#0F172A' }}>{title}</h1>
      {desc && <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: 1.55 }}>{desc}</p>}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 3px 12px rgba(0,0,0,0.02)', padding: '20px 18px', marginBottom: 16 }}>{children}</div>;
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>{children}</h2>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: '0.86rem', color: '#475569', lineHeight: 1.65, marginBottom: 12 }}>{children}</p>;
}

function UL({ items }: { items: React.ReactNode[] }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.86rem', color: '#475569', lineHeight: 1.55 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" style={{ flexShrink: 0, marginTop: 3 }}><polyline points="20 6 9 17 4 12" /></svg>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

// ===================== About Us =====================
export function AboutPage() {
  const values = [
    { icon: 'target', title: 'Customer-First', desc: 'Every feature we build starts with a real customer problem. We listen, build, and iterate.' },
    { icon: 'zap', title: 'Move Fast', desc: 'We ship quickly and learn from feedback. Speed is our competitive advantage.' },
    { icon: 'shield', title: 'Trust & Security', desc: 'Your data is sacred. We invest heavily in security, privacy, and compliance.' },
    { icon: 'users', title: 'Team First', desc: 'We hire passionate people and give them the autonomy to do their best work.' },
  ];
  const stats = [
    { val: '5,000+', label: 'Businesses' },
    { val: '120+', label: 'Cities Served' },
    { val: '50+', label: 'Team Members' },
    { val: '4.8/5', label: 'Customer Rating' },
  ];
  return (
    <InfoLayout title="About Us">
      <PageTitle pill="ABOUT US" title="Building the future of sales in India" desc="LeadFlow CRM was born from a simple idea: sales teams in India deserve a CRM that's powerful, affordable, and built for how they actually work." />
      <Card>
        <H2>Our Story</H2>
        <P>In 2025, our founders were running a growing sales team and struggling with the same tools everyone uses -- expensive CRMs designed for American enterprise, clunky spreadsheets, and WhatsApp groups that spiraled out of control. They knew there had to be a better way.</P>
        <P>LeadFlow CRM was built from the ground up for Indian sales teams. We started with what matters most: a visual pipeline that actually makes sense, WhatsApp integration that works natively (because that's how India communicates), and automation that saves hours every week without requiring a computer science degree to set up.</P>
        <P>Today, over 5,000 businesses across 120+ cities use LeadFlow to manage their leads, automate their follow-ups, and close more deals. We're just getting started.</P>
      </Card>
      <Card>
        <H2>Our Mission</H2>
        <P>To empower every sales team in India with tools that were previously only available to large enterprises. We believe great sales software shouldn't cost a fortune or require a team of engineers to maintain. It should be powerful, intuitive, and built for the way you actually work.</P>
      </Card>
      <Card>
        <H2>Our Values</H2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginTop: 8 }} className="about-values-grid">
          {values.map((v) => (
            <div key={v.title} style={{ padding: '14px', background: '#F8FAFC', borderRadius: 10, border: '1px solid rgba(0,0,0,0.05)' }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(234,179,8,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#CA8A04" strokeWidth="2">
                  {v.icon === 'target' && <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>}
                  {v.icon === 'zap' && <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />}
                  {v.icon === 'shield' && <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />}
                  {v.icon === 'users' && <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></>}
                </svg>
              </div>
              <h4 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.88rem', fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>{v.title}</h4>
              <p style={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.5 }}>{v.desc}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <H2>By the Numbers</H2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }} className="about-stats-grid">
          {stats.map((s) => (
            <div key={s.label} style={{ textAlign: 'center', padding: '14px 8px', background: '#F8FAFC', borderRadius: 10, border: '1px solid rgba(0,0,0,0.05)' }}>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.4rem', fontWeight: 900, color: '#CA8A04' }}>{s.val}</div>
              <div style={{ fontSize: '0.68rem', color: '#475569', fontWeight: 600, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <div style={{ textAlign: 'center' }}>
          <H2>Want to join the journey?</H2>
          <P>Start your 14-day free trial today, or check out our open positions.</P>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
            <a href="#signup" onClick={(e) => { e.preventDefault(); window.location.hash = 'signup'; }} className="gold-cta" style={{ maxWidth: 'fit-content', padding: '10px 20px', fontSize: '0.82rem' }}>
              <span>START FREE TRIAL</span>
            </a>
            <a href="#careers" onClick={(e) => { e.preventDefault(); window.location.hash = 'careers'; }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 14, border: '1px solid rgba(0,0,0,0.15)', background: '#FFFFFF', color: '#0F172A', fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', textDecoration: 'none' }}>
              View Careers
            </a>
          </div>
        </div>
      </Card>
    </InfoLayout>
  );
}

// ===================== Privacy Policy =====================
export function PrivacyPage() {
  const sections = [
    {
      h: '1. Information We Collect',
      c: (
        <>
          <P>We collect information you provide directly to us when you create an account, including your name, email address, phone number, and company details. We also collect information about leads you import or capture through popup forms, including lead names, contact information, and communication history.</P>
          <P>Automatically collected data includes IP addresses, browser type, device information, usage patterns, and interaction data through cookies and similar technologies.</P>
        </>
      ),
    },
    {
      h: '2. How We Use Your Information',
      c: (
        <>
          <UL items={[
            'To provide, maintain, and improve the LeadFlow CRM platform',
            'To send you notifications, follow-up reminders, and broadcast messages on your behalf',
            'To provide analytics, reports, and insights about your sales performance',
            'To communicate with you about updates, security alerts, and support',
            'To detect, prevent, and address fraud, abuse, and security issues',
            'To comply with legal obligations and enforce our terms',
          ]} />
        </>
      ),
    },
    {
      h: '3. Data Storage & Security',
      c: (
        <>
          <P>Your data is stored on encrypted servers hosted by Supabase (AWS infrastructure) with AES-256 encryption at rest and TLS 1.2+ in transit. Access to production data is restricted to authorized personnel using role-based access controls and multi-factor authentication.</P>
          <P>We are ISO 27001 certified and conduct regular security audits and penetration testing. Database access is protected by Row Level Security (RLS) policies ensuring each user can only access their own data.</P>
        </>
      ),
    },
    {
      h: '4. Data Sharing',
      c: (
        <>
          <P>We never sell, rent, or trade your data with third parties. We share data only with:</P>
          <UL items={[
            'Service providers who help us operate the platform (Supabase, WhatsApp Business API, email delivery) under strict data processing agreements',
            'Law enforcement when required by valid legal process',
            'Business transferees in connection with a merger, acquisition, or asset sale',
          ]} />
        </>
      ),
    },
    {
      h: '5. Your Rights',
      c: (
        <>
          <P>You have the right to access, correct, export, or delete your personal data at any time. You can manage your data through your CRM dashboard settings or by contacting us. Account deletion permanently removes all associated data within 30 days.</P>
          <P>You may opt out of marketing communications at any time by clicking the unsubscribe link in any email or adjusting your notification preferences.</P>
        </>
      ),
    },
    {
      h: '6. Cookies',
      c: <P>We use essential cookies for authentication and session management, and analytics cookies to understand how the platform is used. You can control cookie preferences through your browser settings.</P>,
    },
    {
      h: '7. Data Retention',
      c: <P>We retain your data for as long as your account is active. After account deletion, we permanently remove all data within 30 days, except where retention is required by law for financial or legal records.</P>,
    },
    {
      h: '8. Contact Us',
      c: <P>For privacy questions or data requests, email us at privacy@leadflowcrm.com. We respond to all requests within 72 hours.</P>,
    },
  ];
  return (
    <InfoLayout title="Privacy Policy">
      <PageTitle pill="LEGAL" title="Privacy Policy" desc="Last updated: October 7, 2026. Your privacy is fundamental to us. This policy explains what data we collect, how we use it, and the controls you have." />
      {sections.map((s) => (
        <Card key={s.h}>
          <H2>{s.h}</H2>
          {s.c}
        </Card>
      ))}
    </InfoLayout>
  );
}

// ===================== Terms & Conditions =====================
export function TermsPage() {
  const sections = [
    { h: '1. Acceptance of Terms', c: <P>By creating an account or using LeadFlow CRM, you agree to these Terms & Conditions. If you do not agree, you may not use the platform. These terms constitute a legally binding agreement between you and LeadFlow CRM.</P> },
    { h: '2. Description of Service', c: <P>LeadFlow CRM provides a cloud-based sales and lead management platform including pipeline management, WhatsApp and email broadcast, automated follow-ups, analytics, team collaboration, and integration features. We offer 14-day free trials and paid subscription plans.</P> },
    { h: '3. Account Responsibilities', c: (
      <>
        <UL items={[
          'You must provide accurate registration information',
          'You are responsible for maintaining account security and password confidentiality',
          'You are responsible for all activities under your account',
          'You must be at least 18 years old and authorized to represent your organization',
          'One account per organization',
        ]} />
      </>
    ) },
    { h: '4. Acceptable Use', c: (
      <>
        <P>You agree NOT to:</P>
        <UL items={[
          'Use the platform for spam, unsolicited bulk messaging, or illegal activities',
          'Send WhatsApp or email broadcasts to contacts who have not opted in or who have unsubscribed',
          'Attempt to access other users\' data without authorization',
          'Reverse engineer, decompile, or disassemble the platform',
          'Use bots or automated scripts to scrape or overload the platform',
          'Upload malware, viruses, or harmful code',
        ]} />
      </>
    ) },
    { h: '5. Subscription & Billing', c: (
      <>
        <UL items={[
          'Free trials last 14 days with full feature access. No credit card required to start.',
          'Paid plans are billed monthly or yearly in advance. Prices are listed on our pricing page.',
          'You can upgrade, downgrade, or cancel your plan at any time. Changes take effect at the next billing cycle.',
          'Refunds are available within 7 days of payment for monthly plans and within 14 days for yearly plans, subject to fair use.',
          'We may change pricing with 30 days notice. Existing subscribers keep their current rate until renewal.',
        ]} />
      </>
    ) },
    { h: '6. Data & Intellectual Property', c: <P>You retain all rights to your lead data and content. We retain ownership of the platform, its design, code, and branding. You grant us a limited license to process your data solely to provide the service.</P> },
    { h: '7. Service Availability', c: <P>We strive for 99.9% uptime but do not guarantee uninterrupted service. We are not liable for downtime caused by maintenance, third-party failures (WhatsApp API, email providers), or events beyond our control.</P> },
    { h: '8. Limitation of Liability', c: <P>LeadFlow CRM is provided "as is." We are not liable for indirect, incidental, or consequential damages, including lost revenue or leads. Our total liability is limited to the amount you paid in the preceding 12 months.</P> },
    { h: '9. Termination', c: <P>You may terminate your account at any time. We may suspend or terminate accounts that violate these terms. Upon termination, your data is permanently deleted within 30 days unless legally required to retain.</P> },
    { h: '10. Changes to Terms', c: <P>We may update these terms with 30 days notice. Continued use after changes constitutes acceptance. Material changes will be communicated via email.</P> },
    { h: '11. Contact', c: <P>For legal questions, email legal@leadflowcrm.com.</P> },
  ];
  return (
    <InfoLayout title="Terms & Conditions">
      <PageTitle pill="LEGAL" title="Terms & Conditions" desc="Last updated: October 7, 2026. These terms govern your use of LeadFlow CRM. Please read them carefully." />
      {sections.map((s) => (
        <Card key={s.h}>
          <H2>{s.h}</H2>
          {s.c}
        </Card>
      ))}
    </InfoLayout>
  );
}

// ===================== Careers =====================
export function CareersPage() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const jobs = [
    { role: 'Senior Full-Stack Engineer', team: 'Engineering', location: 'Remote (India)', type: 'Full-time', desc: 'Build and scale the LeadFlow CRM platform using React, TypeScript, and Supabase. You\'ll own features end-to-end and work directly with customers.', reqs: ['5+ years React/TypeScript', 'Experience with PostgreSQL', 'Strong product sense', 'Comfortable with rapid iteration'] },
    { role: 'Product Designer', team: 'Design', location: 'Bengaluru (Hybrid)', type: 'Full-time', desc: 'Design intuitive interfaces for sales professionals. You\'ll create wireframes, prototypes, and polished production designs that make complex workflows feel simple.', reqs: ['3+ years product design', 'Proficiency in Figma', 'Experience with SaaS products', 'User research skills'] },
    { role: 'Sales Development Representative', team: 'Sales', location: 'Mumbai (On-site)', type: 'Full-time', desc: 'Drive new business by reaching out to potential customers, running demos, and closing deals. You\'ll be the first touchpoint for businesses discovering LeadFlow.', reqs: ['2+ years B2B SaaS sales', 'Excellent communication skills', 'CRM experience (using one, not just selling one)', 'Self-motivated and goal-oriented'] },
    { role: 'Customer Success Manager', team: 'Success', location: 'Remote (India)', type: 'Full-time', desc: 'Help customers get maximum value from LeadFlow. Onboard new accounts, drive adoption, and reduce churn through proactive engagement.', reqs: ['3+ years in customer success', 'Experience with CRM/SaaS platforms', 'Strong relationship-building skills', 'Data-driven approach to retention'] },
    { role: 'WhatsApp Integration Engineer', team: 'Engineering', location: 'Remote (India)', type: 'Full-time', desc: 'Own the WhatsApp Business API integration including message templates, broadcast systems, webhook handling, and calling features.', reqs: ['3+ years backend experience', 'WhatsApp Business API experience', 'Webhook and real-time systems knowledge', 'Deno/Edge Functions experience a plus'] },
  ];
  const perks = ['Remote-first culture', 'Health insurance for you & family', 'Flexible working hours', 'Learning budget (₹25,000/yr)', 'Stock options for all roles', 'Annual team offsites'];
  return (
    <InfoLayout title="Careers">
      <PageTitle pill="CAREERS" title="Join the team building India's best CRM" desc="We're a passionate team on a mission to make sales software that actually helps. Come build with us." />
      <Card>
        <H2>Why Work at LeadFlow?</H2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginTop: 8 }} className="careers-perks-grid">
          {perks.map((perk) => (
            <div key={perk} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#F8FAFC', borderRadius: 10, border: '1px solid rgba(0,0,0,0.05)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0F172A' }}>{perk}</span>
            </div>
          ))}
        </div>
      </Card>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.2rem', fontWeight: 800, color: '#0F172A', marginBottom: 14 }}>Open Positions ({jobs.length})</h2>
        {jobs.map((job) => (
          <Card key={job.role}>
            <button onClick={() => setExpanded(expanded === job.role ? null : job.role)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
              <div>
                <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.96rem', fontWeight: 800, color: '#0F172A', marginBottom: 3 }}>{job.role}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#CA8A04', background: 'rgba(234,179,8,0.1)', padding: '2px 7px', borderRadius: 9999 }}>{job.team}</span>
                  <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#0EA5E9', background: 'rgba(14,165,233,0.1)', padding: '2px 7px', borderRadius: 9999 }}>{job.location}</span>
                  <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#16A34A', background: 'rgba(22,163,74,0.1)', padding: '2px 7px', borderRadius: 9999 }}>{job.type}</span>
                </div>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: '#94A3B8', transform: expanded === job.role ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', flexShrink: 0 }}><polyline points="6 9 12 15 18 9" /></svg>
            </button>
            {expanded === job.role && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(0,0,0,0.06)', animation: 'setup-fade-in 0.2s ease' }}>
                <P>{job.desc}</P>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>Requirements:</div>
                <UL items={job.reqs} />
                <a href="mailto:careers@leadflowcrm.com" className="gold-cta" style={{ maxWidth: 'fit-content', padding: '9px 18px', fontSize: '0.78rem', marginTop: 4 }}>
                  <span>APPLY NOW</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
                </a>
              </div>
            )}
          </Card>
        ))}
      </div>
      <Card>
        <div style={{ textAlign: 'center' }}>
          <H2>Don't see the right role?</H2>
          <P>Send us your resume and tell us how you'd contribute. We're always looking for exceptional people.</P>
          <a href="mailto:careers@leadflowcrm.com" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 14, border: '1px solid rgba(0,0,0,0.15)', background: '#FFFFFF', color: '#0F172A', fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', textDecoration: 'none' }}>
            Email Careers Team
          </a>
        </div>
      </Card>
    </InfoLayout>
  );
}

// ===================== Security =====================
export function SecurityPage() {
  const measures = [
    { title: 'Encryption at Rest', desc: 'All data is encrypted using AES-256 on AWS-hosted Supabase infrastructure. Even if physical drives were compromised, data remains unreadable.', icon: 'lock' },
    { title: 'Encryption in Transit', desc: 'All communication uses TLS 1.2+ encryption. No data is ever sent over unencrypted channels.', icon: 'shield' },
    { title: 'Row Level Security', desc: 'Database-level policies ensure users can only access their own data. Even with direct database access, cross-tenant data is invisible.', icon: 'database' },
    { title: 'Multi-Factor Authentication', desc: 'Admin accounts require MFA. We strongly recommend enabling it for all team members.', icon: 'key' },
    { title: 'Role-Based Access Control', desc: 'Granular permissions control who can view, edit, delete, or export data. Admins define roles and access levels per team member.', icon: 'users' },
    { title: 'ISO 27001 Certified', desc: 'Our information security management system is ISO 27001 certified and audited annually by independent third parties.', icon: 'badge' },
    { title: 'Regular Penetration Testing', desc: 'We conduct quarterly penetration tests and continuous vulnerability scanning to identify and fix security issues proactively.', icon: 'scan' },
    { title: 'Data Backups', desc: 'Automated daily backups with point-in-time recovery. Backups are encrypted and stored in geographically separated regions.', icon: 'backup' },
  ];
  return (
    <InfoLayout title="Security">
      <PageTitle pill="SECURITY" title="Your data is protected" desc="We invest heavily in security because your leads are your most valuable asset. Here's how we protect them." />
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #FEF08A, #EAB308)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#422006" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m8.5 12 2.3 2.3 4.7-4.7" /></svg>
          </div>
          <div>
            <H2>ISO 27001 Certified</H2>
            <P style={{ marginBottom: 0 }}>Our security practices are audited and certified by independent third parties.</P>
          </div>
        </div>
      </Card>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }} className="security-grid">
        {measures.map((m) => (
          <Card key={m.title}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#CA8A04" strokeWidth="2">
                {m.icon === 'lock' && <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>}
                {m.icon === 'shield' && <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />}
                {m.icon === 'database' && <><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></>}
                {m.icon === 'key' && <><circle cx="7.5" cy="15.5" r="5.5" /><path d="m21 2-9.6 9.6" /><path d="m15.5 7.5 3 3L22 7l-3-3" /></>}
                {m.icon === 'users' && <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></>}
                {m.icon === 'badge' && <><circle cx="12" cy="8" r="6" /><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" /></>}
                {m.icon === 'scan' && <><path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><line x1="7" y1="12" x2="17" y2="12" /></>}
                {m.icon === 'backup' && <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>}
              </svg>
            </div>
            <h4 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.88rem', fontWeight: 800, color: '#0F172A', marginBottom: 5 }}>{m.title}</h4>
            <p style={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.5 }}>{m.desc}</p>
          </Card>
        ))}
      </div>
      <Card>
        <H2>Responsible Disclosure</H2>
        <P>If you discover a security vulnerability, please email security@leadflowcrm.com with details. We respond within 24 hours and offer rewards for verified reports. Please do not publicly disclose vulnerabilities until we've had a chance to address them.</P>
      </Card>
      <Card>
        <H2>Data Deletion</H2>
        <P>You can delete your account and all associated data at any time from your dashboard settings. Deletion is permanent and irreversible. All data is removed within 30 days of deletion.</P>
      </Card>
    </InfoLayout>
  );
}

// ===================== Brand Assets =====================
export function BrandAssetsPage() {
  const colors = [
    { name: 'Primary Gold', hex: '#EAB308', bg: '#EAB308', text: '#000' },
    { name: 'Light Gold', hex: '#FEF08A', bg: '#FEF08A', text: '#422006' },
    { name: 'Dark Gold', hex: '#CA8A04', bg: '#CA8A04', text: '#FFF' },
    { name: 'Deep Gold', hex: '#854D0E', bg: '#854D0E', text: '#FFF' },
    { name: 'Dark Navy', hex: '#0F172A', bg: '#0F172A', text: '#FFF' },
    { name: 'Slate', hex: '#475569', bg: '#475569', text: '#FFF' },
    { name: 'Emerald', hex: '#16A34A', bg: '#16A34A', text: '#FFF' },
    { name: 'Light BG', hex: '#F8FAFC', bg: '#F8FAFC', text: '#0F172A' },
  ];
  const guidelines = [
    'Always use the official logo with clear space around it (minimum 1x the icon height)',
    'Never stretch, rotate, or alter the logo\'s proportions',
    'On dark backgrounds, use the light variant of the logo',
    'Minimum logo size: 28px height for digital, 1cm for print',
    'The gold gradient (FEF08A to EAB308) is our signature. Use it for primary buttons and highlights',
    'Typography: Outfit for headings, Plus Jakarta Sans for body text',
  ];
  return (
    <InfoLayout title="Brand Assets">
      <PageTitle pill="BRAND" title="LeadFlow CRM Brand Guidelines" desc="Use these assets to represent LeadFlow CRM correctly in your content, partnerships, and integrations." />
      <Card>
        <H2>Logo</H2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 }}>
          <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', padding: '20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #FEF08A, #EAB308)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#422006" strokeWidth="2.5"><path d="M3 17l6-6 4 4 8-8" /><path d="M21 7v4h-4" /></svg>
            </div>
            <div>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: '1.1rem', color: '#0F172A' }}>LeadFlow CRM</div>
              <div style={{ fontSize: '0.68rem', color: '#CA8A04', fontWeight: 800, letterSpacing: '0.4px' }}>SALES & LEAD MANAGEMENT</div>
            </div>
          </div>
          <div style={{ background: '#0F172A', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', padding: '20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #FEF08A, #EAB308)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#422006" strokeWidth="2.5"><path d="M3 17l6-6 4 4 8-8" /><path d="M21 7v4h-4" /></svg>
            </div>
            <div>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: '1.1rem', color: '#F1F5F9' }}>LeadFlow CRM</div>
              <div style={{ fontSize: '0.68rem', color: '#FACC15', fontWeight: 800, letterSpacing: '0.4px' }}>SALES & LEAD MANAGEMENT</div>
            </div>
          </div>
        </div>
      </Card>
      <Card>
        <H2>Color Palette</H2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 8 }} className="brand-colors-grid">
          {colors.map((c) => (
            <div key={c.name} style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.06)' }}>
              <div style={{ background: c.bg, padding: '20px 10px', textAlign: 'center', color: c.text, fontSize: '0.72rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>{c.hex}</div>
              <div style={{ background: '#FFFFFF', padding: '7px 8px', fontSize: '0.66rem', fontWeight: 600, color: '#475569', textAlign: 'center' }}>{c.name}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <H2>Usage Guidelines</H2>
        <UL items={guidelines} />
      </Card>
      <Card>
        <H2>Download Assets</H2>
        <P>For high-resolution logo files (SVG, PNG, EPS) and brand kit PDF, please contact us.</P>
        <a href="mailto:brand@leadflowcrm.com" className="gold-cta" style={{ maxWidth: 'fit-content', padding: '10px 20px', fontSize: '0.82rem' }}>
          <span>REQUEST BRAND KIT</span>
        </a>
      </Card>
    </InfoLayout>
  );
}

// ===================== Report Abuse =====================
export function ReportAbusePage() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ type: '', email: '', description: '' });
  const types = [
    'Spam or unsolicited bulk messaging',
    'Phishing or scam activity',
    'Harassment or threatening behavior',
    'Data scraping or unauthorized access',
    'Malware or harmful content',
    'Copyright or trademark infringement',
    'Other policy violation',
  ];
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.type || !form.email || !form.description) return;
    setSubmitted(true);
  };
  return (
    <InfoLayout title="Report Abuse">
      <PageTitle pill="REPORT" title="Report Abuse or Policy Violation" desc="Help us keep LeadFlow CRM safe. Report misuse, spam, or policy violations and our team will investigate promptly." />
      {submitted ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '20px 10px' }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: '#F0FDF4', border: '1px solid rgba(22,163,74,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <H2>Report Submitted</H2>
            <P>Thank you for helping us maintain a safe platform. Our trust & safety team will review your report within 48 hours. If we need more information, we'll contact you at {form.email}.</P>
            <a href="#" onClick={(e) => { e.preventDefault(); window.location.hash = ''; }} className="gold-cta" style={{ maxWidth: 'fit-content', padding: '10px 20px', fontSize: '0.82rem', margin: '0 auto' }}>
              <span>BACK TO HOME</span>
            </a>
          </div>
        </Card>
      ) : (
        <Card>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>Type of Violation *</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                required
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)', fontSize: '0.84rem', fontFamily: 'inherit', background: '#F8FAFC', color: '#0F172A' }}
              >
                <option value="">Select a violation type...</option>
                {types.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>Your Email *</label>
              <input
                type="email"
                required
                placeholder="your@email.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)', fontSize: '0.84rem', fontFamily: 'inherit', background: '#F8FAFC' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>Describe the Issue *</label>
              <textarea
                required
                placeholder="Provide as much detail as possible: account details, URLs, screenshots, dates, and what happened..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={5}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)', fontSize: '0.84rem', fontFamily: 'inherit', background: '#F8FAFC', resize: 'vertical' }}
              />
            </div>
            <button type="submit" className="gold-cta" style={{ maxWidth: 'fit-content', padding: '11px 22px', fontSize: '0.82rem' }}>
              <span>SUBMIT REPORT</span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
            </button>
          </form>
        </Card>
      )}
      <Card>
        <H2>What Happens Next?</H2>
        <UL items={[
          'Our trust & safety team reviews your report within 48 hours',
          'We may contact you for additional information',
          'If the violation is confirmed, we take action ranging from warnings to permanent account suspension',
          'For illegal activity, we cooperate with law enforcement',
          'You will receive a confirmation email when the report is reviewed',
        ]} />
      </Card>
      <Card>
        <H2>Emergency Situations</H2>
        <P>If you believe someone is in immediate danger, contact local emergency services first. For urgent security issues, email security@leadflowcrm.com directly.</P>
      </Card>
    </InfoLayout>
  );
}

// ===================== Sitemap =====================
export function SitemapPage() {
  const sections = [
    {
      title: 'Main Pages',
      links: [
        { label: 'Home', hash: '' },
        { label: 'Sign Up (Free Trial)', hash: 'signup' },
        { label: 'CRM Login', hash: 'admin' },
        { label: 'Super Admin', hash: 'superadmin' },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'About Us', hash: 'about' },
        { label: 'Careers', hash: 'careers' },
        { label: 'Brand Assets', hash: 'brand-assets' },
      ],
    },
    {
      title: 'Legal',
      links: [
        { label: 'Privacy Policy', hash: 'privacy' },
        { label: 'Terms & Conditions', hash: 'terms' },
        { label: 'Security', hash: 'security' },
        { label: 'Report Abuse', hash: 'report-abuse' },
      ],
    },
    {
      title: 'Features',
      links: [
        { label: 'Lead Pipeline Management', hash: '' },
        { label: 'WhatsApp Broadcast', hash: '' },
        { label: 'Email Broadcast', hash: '' },
        { label: 'Automated Follow-ups', hash: '' },
        { label: 'Sales Analytics', hash: '' },
        { label: 'Team Collaboration', hash: '' },
        { label: 'Automation Builder', hash: '' },
        { label: 'Popup Form Builder', hash: '' },
      ],
    },
  ];
  return (
    <InfoLayout title="Sitemap">
      <PageTitle pill="NAVIGATION" title="Sitemap" desc="Find any page on LeadFlow CRM quickly. This sitemap also helps search engines index our content." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }} className="sitemap-grid">
        {sections.map((s) => (
          <Card key={s.title}>
            <H2>{s.title}</H2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {s.links.map((l) => (
                <li key={l.label}>
                  <a href={`#${l.hash}`} onClick={(e) => { e.preventDefault(); window.location.hash = l.hash; }} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.84rem', color: '#475569', textDecoration: 'none', transition: 'color 0.2s', fontWeight: 600 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#CA8A04" strokeWidth="2" style={{ flexShrink: 0 }}><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </InfoLayout>
  );
}
