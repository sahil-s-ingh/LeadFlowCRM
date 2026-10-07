import { useEffect, useState, useRef, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Loader2, CheckCircle2 } from 'lucide-react';

type PopupFormField = {
  id: string;
  type: 'text' | 'email' | 'tel' | 'select' | 'textarea' | 'number' | 'checkbox' | 'radio' | 'date' | 'url';
  label: string;
  placeholder: string;
  required: boolean;
  options: string[];
  mapsTo: 'full_name' | 'mobile_number' | 'email' | 'state' | 'trading_product' | 'fund_amount' | 'custom';
  default_value?: string;
  width?: 'full' | 'half';
};

type PopupForm = {
  id: string;
  user_id?: string;
  title: string;
  subtitle: string;
  fields: PopupFormField[];
  trigger_type: 'time_delay' | 'scroll' | 'exit_intent' | 'immediate';
  trigger_value: number;
  button_text: string;
  button_bg_color: string;
  button_text_color: string;
  success_message?: string;
  show_once?: boolean;
  overlay_color?: string;
  popup_position?: 'center' | 'bottom_left' | 'bottom_right';
  auto_close_delay?: number;
  description?: string;
  image_url?: string;
};

const STORAGE_KEY = 'popup_form_shown';

function hexToRgba(hex: string, opacity: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
}

export default function PopupFormModal() {
  const [form, setForm] = useState<PopupForm | null>(null);
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const scrollTriggeredRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from('popup_forms')
        .select('id, user_id, title, subtitle, fields, trigger_type, trigger_value, button_text, button_bg_color, button_text_color, success_message, show_once, overlay_color, popup_position, auto_close_delay, description, image_url')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (cancelled || !data) return;
      const activeForm = data as PopupForm & { user_id?: string };

      const storage = activeForm.show_once ? localStorage : sessionStorage;
      if (storage.getItem(`${STORAGE_KEY}_${activeForm.id}`)) return;

      // Pre-fill default values
      const defaults: Record<string, string> = {};
      for (const field of activeForm.fields) {
        if (field.default_value) defaults[field.id] = field.default_value;
      }
      if (Object.keys(defaults).length > 0) setValues(defaults);

      setForm(activeForm);

      const trigger = activeForm.trigger_type;

      if (trigger === 'immediate') {
        setVisible(true);
        storage.setItem(`${STORAGE_KEY}_${activeForm.id}`, '1');
      } else if (trigger === 'time_delay') {
        const delay = Math.max(0, (activeForm.trigger_value || 5)) * 1000;
        const timer = setTimeout(() => {
          if (cancelled) return;
          setVisible(true);
          storage.setItem(`${STORAGE_KEY}_${activeForm.id}`, '1');
        }, delay);
        return () => clearTimeout(timer);
      } else if (trigger === 'scroll') {
        const pct = Math.min(90, Math.max(10, activeForm.trigger_value || 50));
        const handler = () => {
          if (scrollTriggeredRef.current || cancelled) return;
          const scrolled = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
          if (scrolled >= pct) {
            scrollTriggeredRef.current = true;
            setVisible(true);
            storage.setItem(`${STORAGE_KEY}_${activeForm.id}`, '1');
            window.removeEventListener('scroll', handler);
          }
        };
        window.addEventListener('scroll', handler, { passive: true });
        return () => window.removeEventListener('scroll', handler);
      } else if (trigger === 'exit_intent') {
        const handler = (e: MouseEvent) => {
          if (cancelled) return;
          if (e.clientY <= 0) {
            setVisible(true);
            storage.setItem(`${STORAGE_KEY}_${activeForm.id}`, '1');
            document.removeEventListener('mouseleave', handler);
          }
        };
        document.addEventListener('mouseleave', handler);
        return () => document.removeEventListener('mouseleave', handler);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSubmitting(true);
    setError('');

    const lead: Record<string, unknown> = {
      status: 'new',
      tags: [],
    };
    const customData: Record<string, string> = {};

    for (const field of form.fields) {
      const val = values[field.id] || '';
      if (field.required && !val.trim()) {
        setError(`Please fill in: ${field.label}`);
        setSubmitting(false);
        return;
      }
      if (field.mapsTo === 'custom') {
        customData[field.label] = val;
      } else if (field.mapsTo === 'trading_product') {
        lead.trading_product = val === 'TradingView Premium' ? 'tradingview_premium' : 'algo';
      } else if (field.mapsTo === 'fund_amount') {
        lead.fund_amount = val ? parseFloat(val) : null;
      } else if (val.trim()) {
        lead[field.mapsTo] = val.trim();
      }
    }

    if (!lead.full_name) lead.full_name = 'N/A';
    if (!lead.mobile_number) lead.mobile_number = 'N/A';
    if (!lead.email) lead.email = 'N/A';
    if (!lead.state) lead.state = 'N/A';
    if (!lead.trading_product) lead.trading_product = 'algo';

    if (Object.keys(customData).length > 0) {
      lead.custom_data = customData;
    }

    const { data: leadData, error: insertError } = await supabase.from('submissions').insert(lead).select('id').single();

    if (insertError) {
      setError('Something went wrong. Please try again.');
      setSubmitting(false);
      return;
    }

    setSubmitted(true);
    setSubmitting(false);

    // Fire-and-forget: trigger automation flows for new leads
    if (leadData?.id) {
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-automations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trigger_type: 'lead_created',
          lead_id: leadData.id,
          lead_data: { ...lead, id: leadData.id },
          user_id: (form as PopupForm & { user_id?: string }).user_id,
        }),
      }).catch(() => { /* best effort */ });
    }

    // Fire-and-forget: send auto welcome email if enabled
    if (leadData?.id && lead.email && lead.email !== 'N/A') {
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-welcome-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: leadData.id,
          fullName: lead.full_name || '',
          email: lead.email,
          tradingProduct: lead.trading_product || 'algo',
          fundAmount: lead.fund_amount ?? null,
        }),
      }).catch(() => { /* best effort */ });
    }

    const delay = form.auto_close_delay ?? 0;
    if (delay > 0) {
      setTimeout(() => setVisible(false), delay * 1000);
    }
  };

  if (!form || !visible) return null;

  const overlayBg = form.overlay_color
    ? hexToRgba(form.overlay_color, 55)
    : 'rgba(0,0,0,0.55)';

  const positionStyle: React.CSSProperties = form.popup_position === 'bottom_left'
    ? { alignItems: 'flex-end', justifyContent: 'flex-start' }
    : form.popup_position === 'bottom_right'
    ? { alignItems: 'flex-end', justifyContent: 'flex-end' }
    : { alignItems: 'center', justifyContent: 'center' };

  const successMsg = form.success_message?.trim() || 'Your details have been submitted. We\'ll be in touch soon.';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: overlayBg, zIndex: 10000,
        display: 'flex', ...positionStyle, padding: '16px',
        animation: 'popupFadeIn 0.3s ease',
      }}
      onClick={() => !submitting && !submitted && setVisible(false)}
    >
      <style>{`
        @keyframes popupFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes popupSlideUp { from { opacity: 0; transform: translateY(24px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes popupSlideInLeft { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes popupSlideInRight { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>
      <div
        style={{
          background: '#fff', borderRadius: '18px', maxWidth: '440px', width: '100%',
          maxHeight: '90vh', overflowY: 'auto', padding: '32px 28px', position: 'relative',
          boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
          animation: form.popup_position === 'bottom_left'
            ? 'popupSlideInLeft 0.35s cubic-bezier(0.16,1,0.3,1)'
            : form.popup_position === 'bottom_right'
            ? 'popupSlideInRight 0.35s cubic-bezier(0.16,1,0.3,1)'
            : 'popupSlideUp 0.35s cubic-bezier(0.16,1,0.3,1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setVisible(false)}
          aria-label="Close"
          style={{
            position: 'absolute', top: '14px', right: '14px', border: 'none',
            background: 'rgba(0,0,0,0.05)', borderRadius: '50%', width: '32px', height: '32px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            color: '#64748b', transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; }}
        >
          <X size={18} />
        </button>

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(22,163,74,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <CheckCircle2 size={28} style={{ color: '#16a34a' }} />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>Thank You!</h2>
            <p style={{ fontSize: '0.88rem', color: '#64748b' }}>{successMsg}</p>
          </div>
        ) : (
          <>
            {form.image_url && (
              <div style={{ marginBottom: '16px', textAlign: 'center' }}>
                <img src={form.image_url} alt="" style={{ maxHeight: '80px', maxWidth: '100%', borderRadius: '8px' }} />
              </div>
            )}
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: '6px', paddingRight: '32px' }}>
              {form.title}
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: form.description ? '8px' : '20px', lineHeight: 1.5 }}>
              {form.subtitle}
            </p>
            {form.description && (
              <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '20px', lineHeight: 1.5 }}>
                {form.description}
              </p>
            )}

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '10px 14px', color: '#dc2626', fontSize: '0.82rem', fontWeight: 600, marginBottom: '14px' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {form.fields.map((field) => {
                const isHalf = field.width === 'half';
                const wrapperStyle: React.CSSProperties = isHalf
                  ? { display: 'inline-block', width: 'calc(50% - 7px)', verticalAlign: 'top' }
                  : {};

                return (
                  <div key={field.id} style={wrapperStyle}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '5px', display: 'block' }}>
                      {field.label} {field.required && <span style={{ color: '#ef4444' }}>*</span>}
                    </label>
                    {field.type === 'textarea' ? (
                      <textarea
                        value={values[field.id] || ''}
                        onChange={(e) => setValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                        placeholder={field.placeholder}
                        rows={3}
                        style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px 14px', fontSize: '0.88rem', fontFamily: 'inherit', outline: 'none', transition: 'border-color 0.15s', boxSizing: 'border-box' }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = form.button_bg_color; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; }}
                      />
                    ) : field.type === 'select' ? (
                      <select
                        value={values[field.id] || ''}
                        onChange={(e) => setValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                        style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px 14px', fontSize: '0.88rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', cursor: 'pointer' }}
                      >
                        <option value="">Select...</option>
                        {field.options.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : field.type === 'radio' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {field.options.map((opt) => (
                          <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input
                              type="radio"
                              name={field.id}
                              value={opt}
                              checked={values[field.id] === opt}
                              onChange={(e) => setValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                              style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: form.button_bg_color }}
                            />
                            <span style={{ fontSize: '0.85rem', color: '#475569' }}>{opt}</span>
                          </label>
                        ))}
                      </div>
                    ) : field.type === 'checkbox' ? (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={values[field.id] === 'true'}
                          onChange={(e) => setValues((prev) => ({ ...prev, [field.id]: e.target.checked ? 'true' : '' }))}
                          style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: form.button_bg_color }}
                        />
                        <span style={{ fontSize: '0.85rem', color: '#475569' }}>{field.placeholder || 'I agree'}</span>
                      </label>
                    ) : (
                      <input
                        type={field.type === 'number' ? 'number' : field.type}
                        value={values[field.id] || ''}
                        onChange={(e) => setValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                        placeholder={field.placeholder}
                        style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px 14px', fontSize: '0.88rem', fontFamily: 'inherit', outline: 'none', transition: 'border-color 0.15s', boxSizing: 'border-box' }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = form.button_bg_color; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; }}
                      />
                    )}
                  </div>
                );
              })}

              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: '100%', padding: '14px', borderRadius: '10px', border: 'none',
                  background: form.button_bg_color, color: form.button_text_color,
                  fontWeight: 700, fontSize: '0.95rem', cursor: submitting ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  transition: 'transform 0.1s, opacity 0.15s', opacity: submitting ? 0.7 : 1,
                }}
                onMouseEnter={(e) => { if (!submitting) e.currentTarget.style.transform = 'scale(1.02)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                {submitting && <Loader2 size={18} className="animate-spin" />}
                {submitting ? 'Submitting...' : form.button_text}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
