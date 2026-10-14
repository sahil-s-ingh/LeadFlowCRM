import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Shield, CheckCircle2, Loader2, CreditCard, Lock, AlertCircle, Smartphone, Globe } from 'lucide-react';

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayResponse) => void;
  prefill: { name: string; email: string; contact: string };
  theme: { color: string };
  modal?: { ondismiss: () => void };
};

type RazorpayResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayInstance = { open: () => void };

type DbPlan = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  monthly_price: number;
  annual_price: number;
  currency: string;
  is_active: boolean;
  is_featured: boolean;
  features: string[];
  cta_label: string;
};

const OPEN_SETUP_EVENT = 'open-mt5-setup';
const PHONEPE_TXN_KEY = 'phonepe_merchant_txn_id';
const PHONEPE_FORM_KEY = 'phonepe_checkout_form';
const PHONEPE_PLAN_KEY = 'phonepe_checkout_plan';
const PAYPAL_ORDER_KEY = 'paypal_order_id';
const PAYPAL_FORM_KEY = 'paypal_checkout_form';
const PAYPAL_PLAN_KEY = 'paypal_checkout_plan';

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

const FALLBACK_PLANS: DbPlan[] = [
  {
    id: 'starter', name: 'Starter', slug: 'starter',
    description: 'For small sales teams getting started',
    monthly_price: 999, annual_price: 799, currency: 'INR',
    is_active: true, is_featured: false, features: [], cta_label: 'Start Free Trial',
  },
  {
    id: 'professional', name: 'Professional', slug: 'professional',
    description: 'For growing teams that need more power',
    monthly_price: 2499, annual_price: 1999, currency: 'INR',
    is_active: true, is_featured: true, features: [], cta_label: 'Start Free Trial',
  },
];

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load payment gateway. Please try again.'));
    document.body.appendChild(script);
  });
}

type Step = 'form' | 'processing' | 'success' | 'error';

type GatewayInfo = {
  active_gateway: string;
  is_active: boolean;
};

export default function CheckoutDrawer() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('form');
  const [plans, setPlans] = useState<DbPlan[] | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [form, setForm] = useState({ fullName: '', mobileNumber: '', email: '', state: '' });
  const [errorMsg, setErrorMsg] = useState('');
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [gateway, setGateway] = useState<GatewayInfo | null>(null);

  const loadPlans = useCallback(async () => {
    const { data } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (data && data.length > 0) {
      setPlans(data as DbPlan[]);
      const featured = (data as DbPlan[]).find((p) => p.is_featured);
      setSelectedPlanId(featured?.id || (data as DbPlan[])[0]?.id || '');
    } else {
      setPlans(FALLBACK_PLANS);
      setSelectedPlanId(FALLBACK_PLANS[1].id);
    }
  }, []);

  const loadGateway = useCallback(async () => {
    const { data } = await supabase
      .from('platform_payment_settings')
      .select('active_gateway, is_active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      setGateway({ active_gateway: data.active_gateway || 'razorpay', is_active: data.is_active });
    } else {
      setGateway({ active_gateway: 'razorpay', is_active: true });
    }
  }, []);

  useEffect(() => {
    const openDrawer = () => {
      setOpen(true);
      setStep('form');
      setErrorMsg('');
      setForm({ fullName: '', mobileNumber: '', email: '', state: '' });
      if (!plans) loadPlans();
      if (!gateway) loadGateway();
    };
    window.addEventListener(OPEN_SETUP_EVENT, openDrawer);
    return () => window.removeEventListener(OPEN_SETUP_EVENT, openDrawer);
  }, [plans, gateway, loadPlans, loadGateway]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Handle PhonePe redirect return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const phonepeRedirect = params.get('phonepe_redirect');
    const merchantTxnId = sessionStorage.getItem(PHONEPE_TXN_KEY);
    const savedForm = sessionStorage.getItem(PHONEPE_FORM_KEY);
    const savedPlan = sessionStorage.getItem(PHONEPE_PLAN_KEY);

    // Handle PayPal redirect return
    const paypalRedirect = params.get('paypal_redirect');
    const paypalOrderId = sessionStorage.getItem(PAYPAL_ORDER_KEY);
    const paypalForm = sessionStorage.getItem(PAYPAL_FORM_KEY);
    const paypalPlan = sessionStorage.getItem(PAYPAL_PLAN_KEY);

    if (paypalRedirect === '1' && paypalOrderId) {
      setOpen(true);
      setStep('processing');
      setErrorMsg('');

      if (paypalForm) {
        try { setForm(JSON.parse(paypalForm)); } catch { /* ignore */ }
      }

      const verifyPayPal = async () => {
        try {
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paypal-verify-payment`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              paypalOrderId,
              ...JSON.parse(paypalForm || '{}'),
              ...JSON.parse(paypalPlan || '{}'),
            }),
          });
          const result = await response.json();
          if (!response.ok || !result.success) {
            throw new Error(result.error || 'PayPal payment verification failed.');
          }
          setStep('success');
          sessionStorage.removeItem(PAYPAL_ORDER_KEY);
          sessionStorage.removeItem(PAYPAL_FORM_KEY);
          sessionStorage.removeItem(PAYPAL_PLAN_KEY);
        } catch (err) {
          setStep('error');
          setErrorMsg(err instanceof Error ? err.message : 'PayPal payment verification failed.');
        }
      };
      verifyPayPal();

      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
      return;
    }

    if (phonepeRedirect === '1' && merchantTxnId) {
      setOpen(true);
      setStep('processing');
      setErrorMsg('');

      if (savedForm) {
        try { setForm(JSON.parse(savedForm)); } catch { /* ignore */ }
      }

      const verifyPhonePe = async () => {
        try {
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/phonepe-verify-payment`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              merchantTxnId,
              ...JSON.parse(savedForm || '{}'),
              ...JSON.parse(savedPlan || '{}'),
            }),
          });
          const result = await response.json();
          if (!response.ok || !result.success) {
            throw new Error(result.error || 'Payment verification failed.');
          }
          setStep('success');
          sessionStorage.removeItem(PHONEPE_TXN_KEY);
          sessionStorage.removeItem(PHONEPE_FORM_KEY);
          sessionStorage.removeItem(PHONEPE_PLAN_KEY);
        } catch (err) {
          setStep('error');
          setErrorMsg(err instanceof Error ? err.message : 'Payment verification failed.');
        }
      };
      verifyPhonePe();

      // Clean the URL
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, []);

  const selectedPlan = plans?.find((p) => p.id === selectedPlanId) || plans?.[0] || FALLBACK_PLANS[0];
  const price = billingCycle === 'monthly' ? selectedPlan.monthly_price : selectedPlan.annual_price;
  const currencySymbol = (c: string) => c === 'INR' ? '\u20B9' : c === 'EUR' ? '\u20AC' : c === 'GBP' ? '\u00A3' : '$';
  const canSubmit = Boolean(form.fullName && form.mobileNumber && form.email && form.state && selectedPlanId);
  const isPhonePe = gateway?.active_gateway === 'phonepe';
  const isPayPal = gateway?.active_gateway === 'paypal';
  const gatewayName = isPhonePe ? 'PhonePe' : isPayPal ? 'PayPal' : 'Razorpay';

  const handlePay = async () => {
    if (!canSubmit) return;
    setCreatingOrder(true);
    setErrorMsg('');
    try {
      if (isPayPal) {
        // PayPal flow: create order, then redirect to PayPal approval page
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paypal-create-order`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            planId: selectedPlan.id,
            planName: selectedPlan.name,
            amount: price,
            currency: selectedPlan.currency,
            billingCycle,
            customerName: form.fullName,
            customerEmail: form.email,
            customerPhone: form.mobileNumber,
            customerState: form.state,
          }),
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || 'Failed to create PayPal order. Please try again.');
        }

        sessionStorage.setItem(PAYPAL_ORDER_KEY, result.paypalOrderId);
        sessionStorage.setItem(PAYPAL_FORM_KEY, JSON.stringify({
          customerName: form.fullName,
          customerEmail: form.email,
          customerPhone: form.mobileNumber,
          customerState: form.state,
        }));
        sessionStorage.setItem(PAYPAL_PLAN_KEY, JSON.stringify({
          planId: selectedPlan.id,
          planName: selectedPlan.name,
          billingCycle,
        }));

        setStep('processing');

        if (result.approvalUrl) {
          window.location.href = result.approvalUrl;
        } else {
          throw new Error('PayPal did not return an approval URL. Please try again.');
        }
      } else if (isPhonePe) {
        // PhonePe flow: create order, then redirect to PhonePe checkout
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/phonepe-create-order`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            planId: selectedPlan.id,
            planName: selectedPlan.name,
            amount: price,
            currency: selectedPlan.currency,
            billingCycle,
            customerName: form.fullName,
            customerEmail: form.email,
            customerPhone: form.mobileNumber,
            customerState: form.state,
          }),
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || 'Failed to create payment order. Please try again.');
        }

        // Save checkout context to sessionStorage for return after redirect
        sessionStorage.setItem(PHONEPE_TXN_KEY, result.merchantTxnId);
        sessionStorage.setItem(PHONEPE_FORM_KEY, JSON.stringify({
          customerName: form.fullName,
          customerEmail: form.email,
          customerPhone: form.mobileNumber,
          customerState: form.state,
        }));
        sessionStorage.setItem(PHONEPE_PLAN_KEY, JSON.stringify({
          planId: selectedPlan.id,
          planName: selectedPlan.name,
          billingCycle,
        }));

        setStep('processing');

        // Redirect to PhonePe checkout page
        if (result.paymentUrl) {
          window.location.href = result.paymentUrl;
        } else {
          throw new Error('PhonePe did not return a payment URL. Please try again.');
        }
      } else {
        // Razorpay flow: popup checkout widget
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/razorpay-create-order`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            planId: selectedPlan.id,
            planName: selectedPlan.name,
            amount: price,
            currency: selectedPlan.currency,
            billingCycle,
            customerName: form.fullName,
            customerEmail: form.email,
            customerPhone: form.mobileNumber,
            customerState: form.state,
          }),
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || 'Failed to create order. Please try again.');
        }
        setStep('processing');

        await loadRazorpayScript();
        if (!window.Razorpay) throw new Error('Payment gateway failed to load.');

        const rzp = new window.Razorpay({
          key: result.keyId,
          amount: result.amount,
          currency: result.currency,
          name: 'LeadFlow CRM',
          description: `${selectedPlan.name} — ${billingCycle}`,
          order_id: result.orderId,
          prefill: { name: form.fullName, email: form.email, contact: form.mobileNumber },
          theme: { color: '#EAB308' },
          modal: {
            ondismiss: () => {
              setStep('form');
              setErrorMsg('Payment cancelled. You can try again.');
            },
          },
          handler: async (rzpResponse: RazorpayResponse) => {
            try {
              const verifyRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/razorpay-verify-payment`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({
                  razorpayOrderId: rzpResponse.razorpay_order_id,
                  razorpayPaymentId: rzpResponse.razorpay_payment_id,
                  razorpaySignature: rzpResponse.razorpay_signature,
                  dbOrderId: result.dbOrderId,
                  customerName: form.fullName,
                  customerEmail: form.email,
                  customerPhone: form.mobileNumber,
                  customerState: form.state,
                  planName: selectedPlan.name,
                  planId: selectedPlan.id,
                }),
              });
              const verifyResult = await verifyRes.json();
              if (!verifyRes.ok) {
                throw new Error(verifyResult.error || 'Payment verification failed.');
              }
              setStep('success');
            } catch (err) {
              setStep('error');
              setErrorMsg(err instanceof Error ? err.message : 'Payment verification failed.');
            }
          },
        });
        rzp.open();
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
    setCreatingOrder(false);
  };

  if (!open) return null;

  return (
    <>
      <style>{`
        @keyframes checkout-slide-in {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes checkout-overlay-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .checkout-overlay { animation: checkout-overlay-in 0.2s ease-out; }
        .checkout-panel { animation: checkout-slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        .checkout-scroll::-webkit-scrollbar { width: 5px; }
        .checkout-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 999px; }
        .checkout-scroll::-webkit-scrollbar-track { background: transparent; }
      `}</style>

      <div
        className="checkout-overlay"
        onClick={() => step !== 'processing' && setOpen(false)}
        style={{
          position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
        }}
      />

      <div
        className="checkout-panel"
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 10001,
          width: '100%', maxWidth: '460px', background: '#fff',
          display: 'flex', flexDirection: 'column',
          boxShadow: '-8px 0 40px rgba(0,0,0,0.15)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '10px',
              background: isPayPal
                ? 'linear-gradient(135deg, #1e3a8a, #1e40af)'
                : isPhonePe
                  ? 'linear-gradient(135deg, #991B1B, #5B21B6)'
                  : 'linear-gradient(135deg, #FEF08A, #EAB308)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {isPayPal ? <Globe size={20} style={{ color: '#fff' }} /> : isPhonePe ? <Smartphone size={20} style={{ color: '#fff' }} /> : <CreditCard size={20} style={{ color: '#422006' }} />}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', fontFamily: 'Outfit, sans-serif' }}>
                {step === 'success' ? 'Payment Complete' : step === 'error' ? 'Payment Issue' : 'Checkout'}
              </h2>
              <p style={{ margin: 0, fontSize: '0.76rem', color: '#64748B' }}>
                {step === 'success' ? 'Your trial is now active' : step === 'error' ? 'Please try again' : `Complete your subscription via ${gatewayName}`}
              </p>
            </div>
          </div>
          {step !== 'processing' && (
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              style={{
                width: '32px', height: '32px', borderRadius: '8px', border: 'none',
                background: '#f8fafc', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', color: '#64748B',
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="checkout-scroll" style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {step === 'success' ? (
            <div style={{ textAlign: 'center', paddingTop: '40px' }}>
              <div style={{
                width: '72px', height: '72px', borderRadius: '50%',
                background: '#f0fdf4', margin: '0 auto 20px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <CheckCircle2 size={40} style={{ color: '#16a34a' }} />
              </div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0F172A', margin: '0 0 8px', fontFamily: 'Outfit, sans-serif' }}>
                Welcome to LeadFlow CRM!
              </h3>
              <p style={{ fontSize: '0.88rem', color: '#64748B', lineHeight: 1.6, maxWidth: '340px', margin: '0 auto 24px' }}>
                Your payment was successful and your 14-day free trial is now active. Check your email for CRM access details and setup instructions.
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  padding: '12px 28px', borderRadius: '10px', border: 'none',
                  background: 'linear-gradient(135deg, #FEF08A, #EAB308)',
                  color: '#422006', fontSize: '0.88rem', fontWeight: 800,
                  cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
                }}
              >
                Got it
              </button>
            </div>
          ) : step === 'error' ? (
            <div style={{ textAlign: 'center', paddingTop: '40px' }}>
              <div style={{
                width: '72px', height: '72px', borderRadius: '50%',
                background: '#fef2f2', margin: '0 auto 20px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <AlertCircle size={40} style={{ color: '#dc2626' }} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0F172A', margin: '0 0 8px', fontFamily: 'Outfit, sans-serif' }}>
                Payment Could Not Be Completed
              </h3>
              <p style={{ fontSize: '0.84rem', color: '#64748B', lineHeight: 1.6, maxWidth: '340px', margin: '0 auto 24px' }}>
                {errorMsg || 'Something went wrong with your payment. Please try again.'}
              </p>
              <button
                type="button"
                onClick={() => { setStep('form'); setErrorMsg(''); }}
                style={{
                  padding: '12px 28px', borderRadius: '10px', border: 'none',
                  background: '#0F172A', color: '#fff', fontSize: '0.88rem', fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
                }}
              >
                Try Again
              </button>
            </div>
          ) : step === 'processing' ? (
            <div style={{ textAlign: 'center', paddingTop: '60px' }}>
              <Loader2 size={48} className="crm-spin" style={{ color: isPayPal ? '#1e3a8a' : isPhonePe ? '#5B21B6' : '#EAB308', margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A', margin: '0 0 6px' }}>
                {isPayPal || isPhonePe ? `Redirecting to ${gatewayName}...` : 'Processing Payment...'}
              </h3>
              <p style={{ fontSize: '0.82rem', color: '#64748B' }}>
                {isPayPal || isPhonePe ? 'You will be redirected to complete your payment.' : 'Please don\u2019t close this window.'}
              </p>
            </div>
          ) : (
            <>
              {/* Plan selection */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Choose Your Plan
                </label>
                {!plans ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                    <Loader2 size={24} className="crm-spin" style={{ color: '#94a3b8' }} />
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {plans.map((plan) => (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => setSelectedPlanId(plan.id)}
                        style={{
                          width: '100%', padding: '14px 16px', borderRadius: '12px',
                          border: selectedPlanId === plan.id ? '2px solid #EAB308' : '1px solid #e2e8f0',
                          background: selectedPlanId === plan.id ? '#FFFDF5' : '#fff',
                          cursor: 'pointer', textAlign: 'left',
                          transition: 'all 0.2s ease',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <strong style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0F172A', fontFamily: 'Outfit, sans-serif' }}>{plan.name}</strong>
                            {plan.is_featured && (
                              <span style={{
                                background: 'linear-gradient(135deg, #FEF08A, #EAB308)',
                                color: '#422006', fontSize: '0.6rem', fontWeight: 900,
                                padding: '2px 8px', borderRadius: '999px', textTransform: 'uppercase',
                              }}>
                                Popular
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '0.76rem', color: '#64748B', display: 'block', marginTop: '2px' }}>
                            {plan.description}
                          </span>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: '1.1rem', fontWeight: 900, color: selectedPlanId === plan.id ? '#CA8A04' : '#0F172A', fontFamily: 'Outfit, sans-serif' }}>
                            {currencySymbol(plan.currency)}{(billingCycle === 'monthly' ? plan.monthly_price : plan.annual_price).toLocaleString('en-IN')}
                          </div>
                          <span style={{ fontSize: '0.66rem', color: '#94a3b8' }}>/mo</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Billing toggle */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                <div style={{
                  display: 'inline-flex', background: '#f8fafc',
                  border: '1px solid #e2e8f0', borderRadius: '999px', padding: 3,
                }}>
                  <button
                    type="button"
                    onClick={() => setBillingCycle('monthly')}
                    style={{
                      padding: '6px 16px', borderRadius: '999px', border: 'none', cursor: 'pointer',
                      fontWeight: 700, fontSize: '0.76rem', transition: 'all 0.2s ease',
                      background: billingCycle === 'monthly' ? 'linear-gradient(135deg, #FEF08A, #EAB308)' : 'transparent',
                      color: billingCycle === 'monthly' ? '#422006' : '#64748B',
                    }}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle('yearly')}
                    style={{
                      padding: '6px 16px', borderRadius: '999px', border: 'none', cursor: 'pointer',
                      fontWeight: 700, fontSize: '0.76rem', transition: 'all 0.2s ease',
                      background: billingCycle === 'yearly' ? 'linear-gradient(135deg, #FEF08A, #EAB308)' : 'transparent',
                      color: billingCycle === 'yearly' ? '#422006' : '#64748B',
                      display: 'flex', alignItems: 'center', gap: '5px',
                    }}
                  >
                    Yearly
                    <span style={{
                      background: 'rgba(22,163,74,0.15)', color: '#15803D',
                      fontSize: '0.58rem', fontWeight: 900, padding: '1px 5px',
                      borderRadius: '999px', border: '1px solid rgba(22,163,74,0.3)',
                    }}>
                      SAVE 20%
                    </span>
                  </button>
                </div>
              </div>

              {/* Divider */}
              <div style={{ height: '1px', background: '#f1f5f9', margin: '0 0 20px' }} />

              {/* Customer details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                    Full Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    placeholder="Enter your full name"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                    Mobile Number <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    inputMode="tel"
                    value={form.mobileNumber}
                    onChange={(e) => setForm({ ...form, mobileNumber: e.target.value })}
                    placeholder="e.g. +91 98765 43210"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                    Email <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="you@example.com"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                    State <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    required
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="" disabled>Select your state</option>
                    {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {errorMsg && (
                <div style={{
                  marginTop: '16px', padding: '12px 14px', borderRadius: '10px',
                  background: '#fef2f2', border: '1px solid #fecaca',
                  fontSize: '0.82rem', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  <AlertCircle size={16} /> {errorMsg}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {step === 'form' && (
          <div style={{
            padding: '16px 24px', borderTop: '1px solid #f1f5f9', flexShrink: 0,
            background: '#fff',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '12px',
            }}>
              <span style={{ fontSize: '0.82rem', color: '#64748B', fontWeight: 600 }}>Total due today</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0F172A', fontFamily: 'Outfit, sans-serif' }}>
                {currencySymbol(selectedPlan.currency)}{price.toLocaleString('en-IN')}
                <span style={{ fontSize: '0.72rem', fontWeight: 500, color: '#94a3b8' }}> /mo</span>
              </span>
            </div>
            <button
              type="button"
              onClick={handlePay}
              disabled={!canSubmit || creatingOrder}
              style={{
                width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                background: canSubmit && !creatingOrder
                  ? (isPayPal
                    ? 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)'
                    : isPhonePe
                      ? 'linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)'
                      : 'linear-gradient(135deg, #FEF08A 0%, #EAB308 100%)')
                  : '#e2e8f0',
                color: canSubmit && !creatingOrder ? (isPayPal || isPhonePe ? '#fff' : '#422006') : '#94a3b8',
                fontSize: '0.92rem', fontWeight: 800, cursor: canSubmit && !creatingOrder ? 'pointer' : 'not-allowed',
                fontFamily: 'Outfit, sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                transition: 'all 0.2s ease',
              }}
            >
              {creatingOrder ? (
                <><Loader2 size={18} className="crm-spin" /> Preparing Checkout...</>
              ) : (
                <>{isPayPal ? <Globe size={16} /> : isPhonePe ? <Smartphone size={16} /> : <Lock size={16} />} Pay {currencySymbol(selectedPlan.currency)}{price.toLocaleString('en-IN')} & Start Trial</>
              )}
            </button>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              marginTop: '10px',
            }}>
              <Shield size={13} style={{ color: '#94a3b8' }} />
              <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                Secured by {gatewayName} &middot; 14-day money-back guarantee
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '10px',
  fontSize: '0.88rem', outline: 'none', color: '#0F172A', background: '#fff',
  fontFamily: 'Plus Jakarta Sans, sans-serif',
};
