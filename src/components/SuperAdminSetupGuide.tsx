import { useState } from 'react';
import { Server, Database, Cloud, GitBranch, Settings, CheckCircle2, AlertCircle, Copy, Terminal, Globe, Shield, Zap } from 'lucide-react';

type Step = {
  id: number;
  icon: React.ReactNode;
  title: string;
  desc: string;
  details: React.ReactNode;
};

export default function SuperAdminSetupGuide() {
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const CodeBlock = ({ code, id }: { code: string; id: string }) => (
    <div style={{ position: 'relative', marginBottom: 12 }}>
      <pre style={{
        background: '#0f172a', color: '#94a3b8', borderRadius: 10,
        padding: '14px 16px', fontSize: '0.82rem', lineHeight: 1.6,
        overflowX: 'auto', fontFamily: 'monospace', margin: 0, paddingRight: 44,
      }}>
        {code}
      </pre>
      <button
        onClick={() => copyToClipboard(code, id)}
        style={{
          position: 'absolute', top: 8, right: 8,
          padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)',
          background: 'rgba(255,255,255,0.08)', color: '#94a3b8', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', fontWeight: 600,
        }}
      >
        {copied === id ? <CheckCircle2 size={13} style={{ color: '#22c55e' }} /> : <Copy size={13} />}
        {copied === id ? 'Copied' : 'Copy'}
      </button>
    </div>
  );

  const steps: Step[] = [
    {
      id: 1,
      icon: <Server size={20} />,
      title: 'Choose Your Hostinger VPS Plan',
      desc: 'Select the right VPS plan for your CRM workloads.',
      details: (
        <>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: 12 }}>
            This CRM is a frontend app (Vite/React) that connects to a managed Supabase backend. The VPS only hosts the static build files, so you don't need a powerful server. Choose based on how many customers you expect:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 16 }}>
            {[
              { plan: 'KVM 1', ram: '4 GB', cpu: '1 vCPU', storage: '50 GB NVMe', cost: '~$4.99/mo', best: 'Up to 500 users', recommended: false },
              { plan: 'KVM 2', ram: '8 GB', cpu: '2 vCPU', storage: '100 GB NVMe', cost: '~$7.99/mo', best: 'Up to 5,000 users', recommended: true },
              { plan: 'KVM 4', ram: '16 GB', cpu: '4 vCPU', storage: '200 GB NVMe', cost: '~$15.99/mo', best: '10,000+ users', recommended: false },
            ].map((p) => (
              <div key={p.plan} style={{
                border: p.recommended ? '2px solid #0f766e' : '1px solid rgba(0,0,0,0.08)',
                borderRadius: 12, padding: '16px 14px', background: p.recommended ? 'rgba(15,118,110,0.04)' : 'var(--bg-card)',
                position: 'relative',
              }}>
                {p.recommended && (
                  <span style={{
                    position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                    background: '#0f766e', color: 'var(--bg-card)', fontSize: '0.62rem', fontWeight: 800,
                    padding: '2px 10px', borderRadius: 9999, letterSpacing: '0.5px', textTransform: 'uppercase',
                  }}>Recommended</span>
                )}
                <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 8px 0' }}>{p.plan}</h4>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                  <div><strong>{p.ram}</strong> RAM</div>
                  <div><strong>{p.cpu}</strong></div>
                  <div><strong>{p.storage}</strong></div>
                  <div style={{ color: '#0f766e', fontWeight: 700, marginTop: 4 }}>{p.cost}</div>
                  <div style={{ marginTop: 6, padding: '4px 8px', background: 'rgba(15,118,110,0.08)', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600, color: '#0f766e' }}>{p.best}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '12px 14px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 10, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <AlertCircle size={18} style={{ color: '#ca8a04', flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: '0.8rem', color: '#854d0e', lineHeight: 1.6, margin: 0 }}>
              Choose <strong>Ubuntu 22.04 or 24.04 LTS</strong> as the operating system when creating your VPS.
            </p>
          </div>
        </>
      ),
    },
    {
      id: 2,
      icon: <Terminal size={20} />,
      title: 'Connect to Your VPS via SSH',
      desc: 'Access your server terminal to begin installation.',
      details: (
        <>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: 12 }}>
            After creating your VPS, connect using SSH from your local machine:
          </p>
          <CodeBlock code={`ssh root@YOUR_VPS_IP`} id="ssh" />
          <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: 12 }}>
            Once connected, update the system packages:
          </p>
          <CodeBlock code={`apt update && apt upgrade -y`} id="apt-update" />
        </>
      ),
    },
    {
      id: 3,
      icon: <Settings size={20} />,
      title: 'Install Node.js and Build Tools',
      desc: 'Set up the runtime needed to build the CRM frontend.',
      details: (
        <>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: 12 }}>
            Install Node.js 20 LTS (required for Vite) and Git:
          </p>
          <CodeBlock code={`curl -fsSL https://deb.nodesource.com/setup_20.x | bash -\napt install -y nodejs git`} id="node-install" />
          <CodeBlock code={`node -v    # should show v20.x.x\nnpm -v     # should show 10.x.x`} id="node-verify" />
        </>
      ),
    },
    {
      id: 4,
      icon: <GitBranch size={20} />,
      title: 'Clone Your CRM Repository',
      desc: 'Download the CRM source code from GitHub to your VPS.',
      details: (
        <>
          <CodeBlock code={`mkdir -p /var/www/leadflow\ncd /var/www/leadflow\ngit clone https://github.com/YOUR_USERNAME/YOUR_REPO.git .`} id="git-clone" />
          <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: 12 }}>
            For private repos, use a GitHub Personal Access Token (PAT):
          </p>
          <CodeBlock code={`git clone https://YOUR_USERNAME:YOUR_TOKEN@github.com/YOUR_USERNAME/YOUR_REPO.git .`} id="git-clone-private" />
        </>
      ),
    },
    {
      id: 5,
      icon: <Database size={20} />,
      title: 'Configure Environment Variables',
      desc: 'Connect the frontend to your Supabase backend.',
      details: (
        <>
          <CodeBlock code={`VITE_SUPABASE_URL=https://your-project.supabase.co\nVITE_SUPABASE_ANON_KEY=your-anon-key\nVITE_SUPABASE_SERVICE_ROLE_KEY=your-service-key`} id="env-vars" />
          <div style={{ padding: '12px 14px', background: 'var(--bg-card)', border: '1px solid #fecaca', borderRadius: 10, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <AlertCircle size={18} style={{ color: '#dc2626', flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: '0.8rem', color: '#991b1b', lineHeight: 1.6, margin: 0 }}>
              Never commit the <code style={{ background: 'rgba(220,38,38,0.1)', padding: '2px 6px', borderRadius: 4, fontSize: '0.78rem' }}>.env</code> file to GitHub.
            </p>
          </div>
        </>
      ),
    },
    {
      id: 6,
      icon: <Zap size={20} />,
      title: 'Install Dependencies and Build',
      desc: 'Compile the CRM into optimized static files.',
      details: (
        <>
          <CodeBlock code={`cd /var/www/leadflow\nnpm install`} id="npm-install" />
          <CodeBlock code={`npm run build`} id="npm-build" />
          <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', lineHeight: 1.65 }}>
            This creates a <code style={{ background: 'var(--bg-light)', padding: '2px 6px', borderRadius: 4, fontSize: '0.78rem' }}>dist/</code> folder with all the static files.
          </p>
        </>
      ),
    },
    {
      id: 7,
      icon: <Globe size={20} />,
      title: 'Install Nginx and Serve the App',
      desc: 'Set up a web server to deliver your CRM to visitors.',
      details: (
        <>
          <CodeBlock code={`apt install -y nginx`} id="nginx-install" />
          <CodeBlock code={`cat > /etc/nginx/sites-available/leadflow << 'EOF'\nserver {\n    listen 80;\n    server_name yourdomain.com www.yourdomain.com;\n    root /var/www/leadflow/dist;\n    index index.html;\n    location / { try_files $uri $uri/ /index.html; }\n    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|webp|woff|woff2)$ {\n        expires 30d;\n        add_header Cache-Control "public, immutable";\n    }\n    gzip on;\n    gzip_types text/css application/javascript application/json image/svg+xml;\n}\nEOF`} id="nginx-config" />
          <CodeBlock code={`ln -sf /etc/nginx/sites-available/leadflow /etc/nginx/sites-enabled/leadflow\nnginx -t && systemctl restart nginx && systemctl enable nginx`} id="nginx-enable" />
        </>
      ),
    },
    {
      id: 8,
      icon: <Shield size={20} />,
      title: 'Add SSL Certificate (HTTPS)',
      desc: 'Secure your site with a free Let\'s Encrypt certificate.',
      details: (
        <>
          <CodeBlock code={`apt install -y certbot python3-certbot-nginx`} id="certbot-install" />
          <CodeBlock code={`certbot --nginx -d yourdomain.com -d www.yourdomain.com`} id="certbot-run" />
          <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', lineHeight: 1.65 }}>
            Choose option 2 to redirect all HTTP traffic to HTTPS. Certbot auto-renews certificates.
          </p>
        </>
      ),
    },
    {
      id: 9,
      icon: <Cloud size={20} />,
      title: 'Set Up Auto-Deploy (Optional)',
      desc: 'Automatically update the CRM when you push to GitHub.',
      details: (
        <>
          <CodeBlock code={`cat > /var/www/leadflow/deploy.sh << 'EOF'\n#!/bin/bash\ncd /var/www/leadflow\ngit pull origin main\nnpm install\nnpm run build\necho "Deploy complete: $(date)"\nEOF\nchmod +x /var/www/leadflow/deploy.sh`} id="deploy-script" />
          <CodeBlock code={`/var/www/leadflow/deploy.sh`} id="deploy-run" />
        </>
      ),
    },
    {
      id: 10,
      icon: <CheckCircle2 size={20} />,
      title: 'Verify and Go Live',
      desc: 'Final checks to confirm everything works.',
      details: (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              'Visit https://yourdomain.com — landing page loads',
              'Click "Sign Up" — signup form works',
              'Create an account — you land in the CRM dashboard',
              'Import a test lead — data saves correctly',
              'Check #/superadmin — super admin login works',
              'Test on mobile — responsive layout looks correct',
              'SSL certificate is active (green padlock in browser)',
            ].map((check, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
                <CheckCircle2 size={18} style={{ color: '#16a34a', flexShrink: 0 }} />
                <span style={{ fontSize: '0.84rem', color: '#14532d', fontWeight: 500 }}>{check}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, padding: '14px 16px', background: 'rgba(15,118,110,0.06)', border: '1px solid rgba(15,118,110,0.2)', borderRadius: 10 }}>
            <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f766e', marginBottom: 6 }}>You're live!</h4>
            <p style={{ fontSize: '0.82rem', color: '#0f766e', lineHeight: 1.6, margin: 0 }}>
              Your CRM is now accessible at your domain. The Supabase backend handles all data, auth, and edge functions automatically.
            </p>
          </div>
        </>
      ),
    },
  ];

  return (
    <div>
      {/* Overview banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(15,118,110,0.08), rgba(15,118,110,0.02))',
        border: '1px solid rgba(15,118,110,0.2)', borderRadius: 14,
        padding: '20px 22px', marginBottom: 28,
      }}>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: 8 }}>How This CRM Works</h2>
        <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: 12 }}>
          LeadCentre CRM has two parts: a <strong>frontend</strong> (the React app you're building) and a <strong>backend</strong> (Supabase — a managed PostgreSQL database with auth, APIs, and edge functions). The frontend is compiled into static files and served by Nginx on your VPS.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ padding: '14px', background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Globe size={18} style={{ color: '#0f766e' }} />
              <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>Frontend (Your VPS)</h4>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-dark)', lineHeight: 1.5, margin: 0 }}>Static HTML/JS/CSS files served by Nginx. Low resource usage. Fast page loads.</p>
          </div>
          <div style={{ padding: '14px', background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Database size={18} style={{ color: '#0f766e' }} />
              <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>Backend (Supabase Cloud)</h4>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-dark)', lineHeight: 1.5, margin: 0 }}>PostgreSQL database, auth, realtime, edge functions. Auto-scaled, auto-backed-up, zero maintenance.</p>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
        {steps.map((step) => (
          <div key={step.id} style={{ background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
            <button
              onClick={() => setActiveStep(activeStep === step.id ? null : step.id)}
              style={{ width: '100%', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: activeStep === step.id ? 'linear-gradient(135deg, #0f766e, #14b8a6)' : 'rgba(15,118,110,0.08)',
                color: activeStep === step.id ? '#fff' : '#0f766e',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}>
                {step.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-dark)' }}>STEP {step.id}</div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)', margin: '2px 0 0 0' }}>{step.title}</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-dark)', margin: '2px 0 0 0' }}>{step.desc}</p>
              </div>
              <div style={{ fontSize: '1.2rem', color: 'var(--text-dark)', transition: 'transform 0.2s ease', transform: activeStep === step.id ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                &#8250;
              </div>
            </button>
            {activeStep === step.id && (
              <div style={{ padding: '0 20px 20px 20px', borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
                {step.details}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Architecture assessment */}
      <div style={{ padding: '22px', background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border-subtle)' }}>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: 14 }}>Is This Architecture Good?</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ padding: '16px', background: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0' }}>
            <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: '#15803d', marginBottom: 10 }}>Pros</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {['Low VPS cost — only serves static files', 'Database auto-scales, no DBA needed', 'Automatic backups and uptime from Supabase', 'SSL and CDN easy to add', 'Fast deploys — just rebuild and copy files', 'Security handled by Supabase RLS policies'].map((p, i) => (
                <li key={i} style={{ display: 'flex', gap: 8, fontSize: '0.8rem', color: '#14532d', lineHeight: 1.5 }}>
                  <CheckCircle2 size={15} style={{ color: '#16a34a', flexShrink: 0, marginTop: 2 }} />{p}
                </li>
              ))}
            </ul>
          </div>
          <div style={{ padding: '16px', background: 'var(--bg-card)', borderRadius: 10, border: '1px solid #fecaca' }}>
            <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: '#dc2626', marginBottom: 10 }}>Things to Watch</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {['Supabase free tier has limits — upgrade as you grow', 'VPS single point of failure', 'No server-side rendering — SEO is limited', 'Large JS bundle — consider code splitting', 'Supabase vendor lock-in for database layer', 'Manual deploy until CI/CD is set up'].map((p, i) => (
                <li key={i} style={{ display: 'flex', gap: 8, fontSize: '0.8rem', color: '#991b1b', lineHeight: 1.5 }}>
                  <AlertCircle size={15} style={{ color: '#dc2626', flexShrink: 0, marginTop: 2 }} />{p}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div style={{ marginTop: 16, padding: '14px 16px', background: 'rgba(15,118,110,0.06)', border: '1px solid rgba(15,118,110,0.2)', borderRadius: 10 }}>
          <p style={{ fontSize: '0.84rem', color: '#0f766e', lineHeight: 1.6, margin: 0 }}>
            <strong>Verdict:</strong> This is a solid, cost-effective architecture for a SaaS CRM. The split between static frontend (cheap VPS) and managed backend (Supabase) is the same pattern used by thousands of production SaaS apps.
          </p>
        </div>
      </div>
    </div>
  );
}
