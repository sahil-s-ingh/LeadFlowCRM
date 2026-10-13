import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import {
  ArrowLeft, Wallet, Loader2, AlertCircle, CheckCircle2, X,
  MessageSquare, TrendingUp, Shield, Phone, IndianRupee, Zap,
  Plus, Minus, Clock, Receipt,
} from 'lucide-react';

type Pricing = {
  marketing_rate: number;
  utility_rate: number;
  authentication_rate: number;
  service_rate: number;
  marketing_markup: number;
  utility_markup: number;
  authentication_markup: number;
  service_markup: number;
  currency: string;
  is_active: boolean;
};

type Package = {
  id: string;
  name: string;
  credits: number;
  price: number;
  currency: string;
};

type Transaction = {
  id: string;
  type: string;
  credits: number;
  balance_after: number;
  reference: string | null;
  created_at: string;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load payment gateway.'));
    document.body.appendChild(script);
  });
}

const currencySymbol = (c: string) => c === 'INR' ? '\u20B9' : c === 'EUR' ? '\u20AC' : c === 'GBP' ? '\u00A3' : '$';

export default function WhatsAppCreditsPage({ session, onBack }: { session: Session; onBack: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [balance, setBalance] = useState(0);
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [balRes, pricingRes, txnRes] = await Promise.all([
        supabase.rpc('get_wa_credit_balance'),
        supabase.rpc('get_wa_pricing'),
        supabase.from('wa_credit_transactions').select('*').order('created_at', { ascending: false }).limit(50),
      ]);
      if (balRes.data !== null) setBalance(balRes.data as number);
      if (pricingRes.data) {
        const p = pricingRes.data as { pricing: Pricing; packages: Package[] };
        setPricing(p.pricing);
        setPackages(p.packages || []);
      }
      if (txnRes.data) setTransactions(txnRes.data as Transaction[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load credit data');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(''), 5000); return () => clearTimeout(t); }
  }, [success]);

  const handlePurchase = async (pkg: Package) => {
    setPurchasing(pkg.id);
    setError('');
    setSuccess('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { setError('Please sign in again.'); return; }

      const createRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wa-credit-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ packageId: pkg.id }),
      });
      const order = await createRes.json();
      if (!createRes.ok) throw new Error(order.error || 'Failed to create order');

      await loadRazorpayScript();
      if (!window.Razorpay) throw new Error('Payment gateway failed to load');

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'WhatsApp Credits',
        description: `${pkg.credits} credits — ${pkg.name}`,
        order_id: order.orderId,
        prefill: { name: session.user.email || '', email: session.user.email || '' },
        theme: { color: '#0f766e' },
        modal: { ondismiss: () => { setPurchasing(null); } },
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          try {
            const verifyRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wa-credit-verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                dbOrderId: order.dbOrderId,
              }),
            });
            const result = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(result.error || 'Payment verification failed');
            setSuccess(`${pkg.credits} credits added to your wallet! New balance: ${result.balance}`);
            await load();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Payment verification failed');
          }
          setPurchasing(null);
        },
      });
      rzp.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setPurchasing(null);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
        <Loader2 size={32} className="crm-spin" style={{ color: '#0f766e' }} />
      </div>
    );
  }

  const cur = pricing?.currency || 'INR';
  const sym = currencySymbol(cur);
  const creditSystemOn = pricing?.is_active;

  const categoryCards = [
    { label: 'Marketing', icon: <TrendingUp size={16} />, color: '#d97706', rate: pricing?.marketing_rate, markup: pricing?.marketing_markup, desc: 'Promotional messages and offers' },
    { label: 'Utility', icon: <Zap size={16} />, color: '#2563eb', rate: pricing?.utility_rate, markup: pricing?.utility_markup, desc: 'Account updates and confirmations' },
    { label: 'Authentication', icon: <Shield size={16} />, color: '#7c3aed', rate: pricing?.authentication_rate, markup: pricing?.authentication_markup, desc: 'OTP and verification codes' },
    { label: 'Service', icon: <MessageSquare size={16} />, color: '#0891b2', rate: pricing?.service_rate, markup: pricing?.service_markup, desc: 'Customer-initiated conversations' },
  ];

  return (
    <div className="dash-overview" style={{ maxWidth: '960px', margin: '0 auto' }}>
      {error && <Banner type="error" message={error} onClose={() => setError('')} />}
      {success && <Banner type="success" message={success} onClose={() => setSuccess('')} />}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button type="button" onClick={onBack} style={{ ...iconBtn, flexShrink: 0 }}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>WhatsApp Credits</h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-dark)' }}>Buy prepaid message credits for WhatsApp broadcasts</p>
        </div>
      </div>

      {/* Balance + Status */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ ...cardStyle, background: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)', border: 'none', color: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <Wallet size={20} />
            <span style={{ fontSize: '0.78rem', fontWeight: 600, opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Current Balance</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>{balance.toLocaleString()}</div>
          <div style={{ fontSize: '0.76rem', opacity: 0.8, marginTop: '4px' }}>message credits available</div>
        </div>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: creditSystemOn ? 'rgba(22,163,74,0.1)' : 'rgba(148,163,184,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {creditSystemOn ? <CheckCircle2 size={16} style={{ color: '#16a34a' }} /> : <AlertCircle size={16} style={{ color: '#94a3b8' }} />}
            </div>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-dark)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Credit System</span>
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: creditSystemOn ? '#16a34a' : 'var(--text-dark)' }}>
            {creditSystemOn ? 'Active' : 'Not Required'}
          </div>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-dark)', marginTop: '4px' }}>
            {creditSystemOn ? 'Credits are deducted per message sent' : 'Broadcasts are free — no credits needed'}
          </div>
        </div>
      </div>

      {/* Pricing breakdown */}
      <div style={{ ...cardStyle, marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Receipt size={18} style={{ color: '#0f766e' }} />
          <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>WhatsApp Message Pricing</h2>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-dark)', margin: '0 0 16px' }}>
          Official WhatsApp Business API pricing per conversation category. The final price includes Meta's rate plus a platform fee.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          {categoryCards.map((cat) => {
            const rate = Number(cat.rate || 0);
            const markup = Number(cat.markup || 0);
            const total = rate + markup;
            return (
              <div key={cat.label} style={{ background: 'var(--bg-light)', borderRadius: '12px', padding: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: `${cat.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cat.color }}>
                    {cat.icon}
                  </div>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>{cat.label}</span>
                </div>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-dark)', margin: '0 0 10px' }}>{cat.desc}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-dark)', marginBottom: '3px' }}>
                  <span>Meta rate</span><span>{sym}{rate.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-dark)', marginBottom: '3px' }}>
                  <span>Platform fee</span><span>{sym}{markup.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 700, color: cat.color, borderTop: '1px solid var(--border-subtle)', paddingTop: '6px', marginTop: '6px' }}>
                  <span>Per message</span><span>{sym}{total.toFixed(2)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Buy credits */}
      <div style={{ ...cardStyle, marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <IndianRupee size={18} style={{ color: '#2563eb' }} />
          <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>Buy Credit Packages</h2>
        </div>
        {packages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-dark)', margin: 0 }}>No credit packages available yet. Please check back later.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            {packages.map((pkg, idx) => {
              const perCredit = pkg.credits > 0 ? (pkg.price / pkg.credits) : 0;
              const isFeatured = idx === 1 || (packages.length === 1 && idx === 0);
              return (
                <div key={pkg.id} style={{
                  background: isFeatured ? 'linear-gradient(135deg, rgba(15,118,110,0.06), rgba(20,184,166,0.04))' : 'var(--bg-light)',
                  borderRadius: '14px', padding: '18px', border: isFeatured ? '2px solid #0f766e' : '1px solid var(--border-subtle)',
                  display: 'flex', flexDirection: 'column', gap: '10px',
                }}>
                  {isFeatured && (
                    <span style={{ alignSelf: 'flex-start', padding: '3px 10px', borderRadius: '9999px', background: '#0f766e', color: '#fff', fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase' }}>Best Value</span>
                  )}
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>{pkg.name}</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    {pkg.credits.toLocaleString()} <span style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-dark)' }}>credits</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dark)' }}>
                    {sym}{perCredit.toFixed(2)} per message
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f766e' }}>{sym}{Number(pkg.price).toFixed(0)}</div>
                  <button type="button" onClick={() => handlePurchase(pkg)} disabled={purchasing !== null} style={{
                    ...primaryBtn, opacity: purchasing !== null && purchasing !== pkg.id ? 0.5 : 1,
                  }}>
                    {purchasing === pkg.id ? <Loader2 size={15} className="crm-spin" /> : <Plus size={15} />} Buy Now
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Transaction history */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Clock size={18} style={{ color: '#0891b2' }} />
          <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>Transaction History</h2>
        </div>
        {transactions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-dark)', margin: 0 }}>No transactions yet. Your credit purchases and usage will appear here.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-light)' }}>
                  {['Type', 'Credits', 'Balance After', 'Reference', 'Date'].map((h) => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-dark)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.map((txn) => {
                  const isPurchase = txn.type === 'purchase';
                  return (
                    <tr key={txn.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '10px 14px', fontSize: '0.82rem' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, textTransform: 'capitalize', background: isPurchase ? 'rgba(22,163,74,0.1)' : 'rgba(239,68,68,0.1)', color: isPurchase ? '#16a34a' : '#ef4444' }}>
                          {isPurchase ? <Plus size={11} /> : <Minus size={11} />} {txn.type}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '0.82rem', fontWeight: 700, color: isPurchase ? '#16a34a' : '#ef4444' }}>
                        {txn.credits > 0 ? '+' : ''}{txn.credits}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '0.82rem', color: 'var(--text-main)' }}>{txn.balance_after.toLocaleString()}</td>
                      <td style={{ padding: '10px 14px', fontSize: '0.78rem', color: 'var(--text-dark)' }}>{txn.reference || '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: '0.78rem', color: 'var(--text-dark)' }}>{new Date(txn.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-subtle)',
  padding: '20px 22px',
};

const iconBtn: React.CSSProperties = {
  width: '38px', height: '38px', borderRadius: '10px', border: '1px solid var(--border-subtle)',
  background: 'var(--bg-card)', color: 'var(--text-muted)', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const primaryBtn: React.CSSProperties = {
  padding: '9px 16px', borderRadius: '9px', border: 'none', background: '#0f766e',
  color: '#fff', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'opacity 0.15s',
};

function Banner({ type, message, onClose }: { type: 'error' | 'success'; message: string; onClose: () => void }) {
  const isErr = type === 'error';
  return (
    <div style={{
      padding: '12px 16px', borderRadius: '12px', fontSize: '0.85rem', marginBottom: '16px',
      display: 'flex', alignItems: 'center', gap: '10px',
      background: isErr ? '#fef2f2' : '#f0fdf4', border: `1px solid ${isErr ? '#fecaca' : '#bbf7d0'}`,
      color: isErr ? '#dc2626' : '#16a34a',
    }}>
      {isErr ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />} {message}
      <button type="button" onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.6 }}><X size={16} /></button>
    </div>
  );
}
