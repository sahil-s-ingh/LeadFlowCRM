import { useEffect, useState, useCallback, useRef, Fragment } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import {
  ArrowLeft, Loader2, RefreshCw, Plus, Send, Trash2, Pencil,
  FileText as FileTextIcon, AlertTriangle, Link2, Phone, MessageSquare,
  CheckCircle2, XCircle, Clock, Image as ImageIcon, Video, FileText,
  Type, Search, Eye, Info, Sparkles, Copy, Languages, Upload,
  ChevronLeft, ChevronRight, BarChart3, KeyRound, X, UploadCloud,
  Tags, Folder, History, FlaskConical, Library, CheckSquare, Square,
  Archive, TrendingUp, Award, Zap, Tag as TagIcon, FileSearch,
  ChevronDown, MoreVertical, Rocket,
  ShieldCheck, Download, Upload as UploadIcon, Activity, GitBranch,
  Layers, AlertCircle, Clock3, Globe, Check, FileJson, UserCheck,
  ClipboardCheck, CalendarClock, Users, Bell,
} from 'lucide-react';

type HeaderFormat = 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'NONE';
type TplButtonKind = 'CUSTOM' | 'WEBSITE' | 'WHATSAPP' | 'PHONE' | 'FLOW' | 'COPY_CODE' | 'SHARE_CONTACT';
type TplButton = { type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'FLOW' | 'OTP'; kind?: TplButtonKind; text: string; url?: string; phone?: string; flowId?: string; navigateScreen?: string };
type CarouselCard = {
  mediaFormat: 'IMAGE' | 'VIDEO';
  mediaUrl: string;
  bodyText: string;
  bodyExample?: string;
  buttons: TplButton[];
};
type TemplateMode = 'standard' | 'carousel' | 'authentication';

type WaTemplate = {
  meta_template_id: string | null;
  name: string;
  language: string;
  category: string;
  status: string;
  components: any[];
  rejection_reason: string | null;
  archived?: boolean;
  phone_label?: string;
};

type TemplateTag = {
  id: string;
  name: string;
  color: string;
  count?: number;
};

type TemplateVersion = {
  id: string;
  version_number: number;
  components: any[];
  name: string;
  changed_by: string | null;
  created_at: string;
};

type ABTest = {
  id: string;
  name: string;
  variant_a_template: string;
  variant_b_template: string;
  variant_a_language: string;
  variant_b_language: string;
  status: string;
  split_percentage: number;
  total_sent_a: number;
  total_sent_b: number;
  delivered_a: number;
  delivered_b: number;
  read_a: number;
  read_b: number;
  clicked_a: number;
  clicked_b: number;
  winner: string | null;
  created_at: string;
};

const LANGUAGES: { value: string; label: string }[] = [
  { value: 'en_US', label: 'English (US)' },
  { value: 'en', label: 'English' },
  { value: 'en_GB', label: 'English (UK)' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ta', label: 'Tamil' },
  { value: 'te', label: 'Telugu' },
  { value: 'bn', label: 'Bengali' },
  { value: 'mr', label: 'Marathi' },
  { value: 'gu', label: 'Gujarati' },
  { value: 'kn', label: 'Kannada' },
  { value: 'ml', label: 'Malayalam' },
  { value: 'pa', label: 'Punjabi' },
  { value: 'es', label: 'Spanish' },
  { value: 'pt_BR', label: 'Portuguese (BR)' },
  { value: 'ar_AR', label: 'Arabic' },
  { value: 'fr_FR', label: 'French' },
  { value: 'de_DE', label: 'German' },
  { value: 'id', label: 'Indonesian' },
  { value: 'it', label: 'Italian' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'ru', label: 'Russian' },
  { value: 'th', label: 'Thai' },
  { value: 'tr', label: 'Turkish' },
  { value: 'vi', label: 'Vietnamese' },
  { value: 'zh_CN', label: 'Chinese (Simplified)' },
  { value: 'zh_TW', label: 'Chinese (Traditional)' },
];

const PREBUILT_TEMPLATES: { name: string; category: string; body: string; footer: string; header?: string; buttons?: { type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'; text: string; url?: string }[]; tag: string }[] = [
  { name: 'welcome_message', category: 'MARKETING', tag: 'Onboarding', header: 'Welcome to Our Family!', body: 'Hi {{1}}, welcome aboard! We are thrilled to have you. Your account is all set up and ready to go. If you need any help, just reply to this message.', footer: 'Reply STOP to unsubscribe', buttons: [{ type: 'QUICK_REPLY', text: 'Get Started' }, { type: 'QUICK_REPLY', text: 'Talk to Support' }] },
  { name: 'order_confirmation', category: 'UTILITY', tag: 'Transactional', header: 'Order Confirmed', body: 'Hi {{1}}, your order {{2}} has been confirmed! Total: {{3}}. Expected delivery: {{4}}. Track your order anytime.', footer: 'Thank you for your purchase', buttons: [{ type: 'URL', text: 'Track Order', url: 'https://example.com/track' }] },
  { name: 'appointment_reminder', category: 'UTILITY', tag: 'Reminders', header: 'Appointment Reminder', body: 'Hi {{1}}, this is a reminder for your appointment on {{2}} at {{3}}. Please reply CONFIRM to confirm or RESCHEDULE to change.', footer: 'We look forward to seeing you', buttons: [{ type: 'QUICK_REPLY', text: 'Confirm' }, { type: 'QUICK_REPLY', text: 'Reschedule' }] },
  { name: 'festival_offer', category: 'MARKETING', tag: 'Festival Offers', header: 'Special Festival Offer!', body: 'Hi {{1}}, celebrate {{2}} with us! Get {{3}}% off on all products. Use code {{4}} at checkout. Offer valid till {{5}}.', footer: 'Reply STOP to unsubscribe', buttons: [{ type: 'URL', text: 'Shop Now', url: 'https://example.com/shop' }, { type: 'QUICK_REPLY', text: 'More Info' }] },
  { name: 'reengagement', category: 'MARKETING', tag: 'Re-engagement', body: 'Hi {{1}}, we miss you! It has been a while since your last visit. Here is a special {{2}}% discount just for you. Come back and see what is new!', footer: 'Reply STOP to unsubscribe', buttons: [{ type: 'URL', text: 'Claim Offer', url: 'https://example.com/offer' }] },
  { name: 'payment_receipt', category: 'UTILITY', tag: 'Transactional', header: 'Payment Received', body: 'Hi {{1}}, we have received your payment of {{2}} for {{3}}. Transaction ID: {{4}}. Your receipt has been emailed to you.', footer: 'Thank you for your payment' },
  { name: 'shipping_update', category: 'UTILITY', tag: 'Transactional', body: 'Hi {{1}}, your order {{2}} has been shipped! Track it here: {{3}}. Expected delivery: {{4}}.', footer: 'Reply STOP to unsubscribe', buttons: [{ type: 'URL', text: 'Track Package', url: 'https://example.com/track' }] },
  { name: 'feedback_request', category: 'MARKETING', tag: 'Feedback', body: 'Hi {{1}}, thanks for choosing us! How was your experience? Reply with a rating from 1-5 or click below to leave a detailed review.', footer: 'Your feedback matters', buttons: [{ type: 'URL', text: 'Leave Review', url: 'https://example.com/review' }, { type: 'QUICK_REPLY', text: '5 - Excellent' }, { type: 'QUICK_REPLY', text: '1 - Poor' }] },
  { name: 'cart_abandonment', category: 'MARKETING', tag: 'Re-engagement', body: 'Hi {{1}}, you left {{2}} in your cart! Complete your purchase now and get free shipping. Your items are waiting for you.', footer: 'Reply STOP to unsubscribe', buttons: [{ type: 'URL', text: 'Complete Order', url: 'https://example.com/cart' }] },
  { name: 'birthday_wish', category: 'MARKETING', tag: 'Festival Offers', header: 'Happy Birthday!', body: 'Hi {{1}}, Happy Birthday from all of us! As a special gift, enjoy {{2}}% off your next purchase. Use code {{3}} valid for 7 days.', footer: 'Reply STOP to unsubscribe', buttons: [{ type: 'URL', text: 'Claim Gift', url: 'https://example.com/gift' }] },
  { name: 'verification_code', category: 'AUTHENTICATION', tag: 'OTP', body: '{{1}} is your verification code. For your security, do not share this code with anyone.', footer: 'Do not share this code' },
  { name: 'event_invitation', category: 'MARKETING', tag: 'Festival Offers', header: 'You are Invited!', body: 'Hi {{1}}, you are invited to {{2}} on {{3}} at {{4}}. Join us for an exciting event! RSVP by {{5}} to confirm your spot.', footer: 'Reply STOP to unsubscribe', buttons: [{ type: 'QUICK_REPLY', text: 'Yes, I will attend' }, { type: 'QUICK_REPLY', text: 'Cannot attend' }] },
];

const BANNED_WORDS = [
  'free', 'win', 'winner', 'won', 'prize', 'gift', 'guaranteed', 'lottery', 'earn',
  'click here', 'buy now', 'limited time', 'act now', 'urgent', 'congratulations you',
  'selected for', 'exclusive deal', '100% off', 'casino', 'gambling', 'loan', 'credit card',
];

const MARKETING_OPTOUT_PHRASES = ['stop', 'unsubscribe', 'opt out', 'opt-out'];

const LEAD_FIELDS = [
  { value: 'name', label: 'Lead Name', example: 'John Doe' },
  { value: 'phone', label: 'Phone Number', example: '+1234567890' },
  { value: 'email', label: 'Email', example: 'john@example.com' },
  { value: 'fund_amount', label: 'Fund Amount', example: '$5,000' },
  { value: 'account_type', label: 'Account Type', example: 'Standard' },
  { value: 'partner_code', label: 'Partner Code', example: 'ABC123' },
  { value: 'lead_source', label: 'Lead Source', example: 'Facebook Ads' },
  { value: 'country', label: 'Country', example: 'India' },
  { value: 'created_date', label: 'Signup Date', example: 'Oct 17, 2026' },
  { value: 'broker', label: 'Broker Name', example: 'IC Markets' },
];

function checkCompliance(body: string, category: string, footer: string, header: string): { passed: boolean; warnings: { type: 'error' | 'warning' | 'info'; message: string }[] } {
  const warnings: { type: 'error' | 'warning' | 'info'; message: string }[] = [];
  const lowerBody = body.toLowerCase();
  const combined = (body + ' ' + footer + ' ' + header).toLowerCase();
  // Check banned words
  for (const word of BANNED_WORDS) {
    if (lowerBody.includes(word)) {
      warnings.push({ type: 'error', message: `Banned word detected: "${word}". Meta frequently rejects templates containing this word.` });
    }
  }
  // Marketing needs opt-out
  if (category === 'MARKETING') {
    const hasOptout = MARKETING_OPTOUT_PHRASES.some((p) => combined.includes(p));
    if (!hasOptout) {
      warnings.push({ type: 'warning', message: 'Marketing templates should include an opt-out phrase like "Reply STOP to unsubscribe" in the footer.' });
    }
  }
  // Body length
  if (body.length > 1024) {
    warnings.push({ type: 'error', message: 'Body text exceeds 1024 characters. Meta will reject this template.' });
  }
  // Excessive caps
  const capsRatio = (body.match(/[A-Z]/g) || []).length / Math.max(body.replace(/[^a-zA-Z]/g, '').length, 1);
  if (capsRatio > 0.5 && body.length > 20) {
    warnings.push({ type: 'warning', message: 'Excessive capitalization detected. Meta may flag this as spammy.' });
  }
  // Too many variables
  const varCount = (body.match(/\{\{\d+\}\}/g) || []).length;
  if (varCount > 10) {
    warnings.push({ type: 'warning', message: `Template has ${varCount} variables. Too many variables increase rejection risk and make messages harder to personalize.` });
  }
  // URL in body
  if (/https?:\/\//.test(body)) {
    warnings.push({ type: 'warning', message: 'URLs in body text are not allowed. Use a URL button instead.' });
  }
  // Authentication check
  if (category === 'AUTHENTICATION') {
    const bodyVars = (body.match(/\{\{(\d+)\}\}/g) || []).map((m) => parseInt(m.match(/\d+/)![0], 10));
    if (bodyVars.some((v) => v !== 1)) {
      warnings.push({ type: 'error', message: 'Authentication templates can only use {{1}} for the OTP code.' });
    }
  }
  // All caps short body
  if (body.length < 20 && body.length > 0) {
    warnings.push({ type: 'info', message: 'Body text is very short. Consider adding more context for better engagement.' });
  }
  const passed = warnings.filter((w) => w.type === 'error').length === 0;
  return { passed, warnings };
}

function normalizeForComparison(text: string): string {
  return text.toLowerCase().replace(/\{\{\d+\}\}/g, '{{N}}').replace(/\s+/g, ' ').trim();
}

const CATEGORIES: { value: string; label: string; desc: string; color: string }[] = [
  { value: 'MARKETING', label: 'Marketing', desc: 'Promotional offers, product announcements, and marketing messages', color: '#C2410C' },
  { value: 'UTILITY', label: 'Utility', desc: 'Transactional alerts, appointment reminders, and account updates', color: '#0891B2' },
  { value: 'AUTHENTICATION', label: 'Authentication', desc: 'One-time passwords and authentication codes', color: '#7C3AED' },
];

const statusConfig: Record<string, { bg: string; color: string; icon: React.ReactNode; label: string }> = {
  APPROVED: { bg: 'rgba(22,163,74,0.12)', color: '#16a34a', icon: <CheckCircle2 size={13} />, label: 'Approved' },
  PENDING: { bg: 'rgba(245,158,11,0.12)', color: '#d97706', icon: <Clock size={13} />, label: 'Pending Review' },
  REJECTED: { bg: 'rgba(239,68,68,0.12)', color: '#dc2626', icon: <XCircle size={13} />, label: 'Rejected' },
};

const categoryConfig: Record<string, { color: string; bg: string }> = {
  MARKETING: { color: '#C2410C', bg: 'rgba(194, 65, 12, 0.1)' },
  UTILITY: { color: '#0891B2', bg: 'rgba(8, 145, 178, 0.1)' },
  AUTHENTICATION: { color: '#7C3AED', bg: 'rgba(124, 58, 237, 0.1)' },
};

const headerFormatConfig: Record<HeaderFormat, { label: string; icon: React.ReactNode; desc: string }> = {
  NONE: { label: 'No Header', icon: <Type size={16} />, desc: 'Skip the header entirely' },
  TEXT: { label: 'Text', icon: <Type size={16} />, desc: 'Short title above the body (max 60 chars)' },
  IMAGE: { label: 'Image', icon: <ImageIcon size={16} />, desc: 'Image shown at the top of the message' },
  VIDEO: { label: 'Video', icon: <Video size={16} />, desc: 'Video shown at the top of the message' },
  DOCUMENT: { label: 'Document', icon: <FileText size={16} />, desc: 'PDF document shown at the top' },
};

function renderTextWithVars(text: string, examples?: string[]): React.ReactNode {
  if (!text) return null;
  const parts = text.split(/(\{\{\d+\}\})/g);
  return parts.map((part, i) => {
    const match = part.match(/\{\{(\d+)\}\}/);
    if (match) {
      const idx = parseInt(match[1], 10) - 1;
      const exampleVal = examples?.[idx];
      return <span key={i} className="mt2-var-highlight">{exampleVal || part}</span>;
    }
    return <span key={i}>{part}</span>;
  });
}

function WaPhonePreview({ headerFormat, headerText, headerExample, body, bodyExamples, footer, buttons, mediaUrl }: {
  headerFormat: HeaderFormat;
  headerText: string;
  headerExample: string;
  body: string;
  bodyExamples: string[];
  footer: string;
  buttons: TplButton[];
  mediaUrl: string;
}) {
  const bodyExampleArr = bodyExamples.length > 0 ? bodyExamples : [];
  const hasContent = headerText.trim() || body.trim() || footer.trim() || buttons.length > 0 || mediaUrl.trim();

  if (!hasContent) {
    return (
      <div className="mt2-phone-empty">
        <MessageSquare size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
        <span>Start typing to see a live preview</span>
        <span className="mt2-phone-empty-sub">Your template will appear here as it looks in WhatsApp</span>
      </div>
    );
  }

  return (
    <div className="mt2-wa-chat">
      <div className="mt2-wa-chat-bar">
        <div className="mt2-wa-chat-back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        </div>
        <div className="mt2-wa-chat-avatar"><MessageSquare size={14} /></div>
        <div className="mt2-wa-chat-name-col">
          <span className="mt2-wa-chat-name">Your Business</span>
          <span className="mt2-wa-chat-status">online</span>
        </div>
        <div className="mt2-wa-chat-icons">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.36 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.34 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
        </div>
      </div>
      <div className="mt2-wa-chat-body">
        <div className="mt2-wa-msg-bubble">
          <div className="mt2-wa-msg-tail" />
          {headerFormat === 'IMAGE' && mediaUrl.trim() && (
            <div className="mt2-wa-media-wrap"><img src={mediaUrl} alt="Template media" className="mt2-wa-media-img" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /></div>
          )}
          {headerFormat === 'VIDEO' && mediaUrl.trim() && (
            <div className="mt2-wa-media-wrap"><video src={mediaUrl} className="mt2-wa-media-video" controls /></div>
          )}
          {headerFormat === 'DOCUMENT' && mediaUrl.trim() && (
            <div className="mt2-wa-media-doc"><FileText size={20} /><span>{mediaUrl.split('/').pop() || 'Document'}</span></div>
          )}
          {headerFormat === 'TEXT' && headerText.trim() && (
            <div className="mt2-wa-msg-header">{renderTextWithVars(headerText, headerExample ? [headerExample] : [])}</div>
          )}
          {body.trim() && <div className="mt2-wa-msg-body">{renderTextWithVars(body, bodyExampleArr)}</div>}
          {footer.trim() && <div className="mt2-wa-msg-footer">{footer}</div>}
          <div className="mt2-wa-msg-time">
            12:00 PM
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 4 }}><path d="M1.5 12.5L4 15l6-6.5"/><path d="M12 15l7-7"/><path d="M21 15l2-2"/></svg>
          </div>
        </div>
        {buttons.length > 0 && (
          <div className="mt2-wa-msg-buttons">
            {buttons.map((btn, i) => (
              <div key={i} className="mt2-wa-msg-btn">
                {btn.type === 'URL' && <Link2 size={13} />}
                {btn.type === 'PHONE_NUMBER' && <Phone size={13} />}
                {btn.type === 'FLOW' && <Rocket size={13} />}
                {btn.type === 'QUICK_REPLY' && <MessageSquare size={13} />}
                <span>{btn.text || `Button ${i + 1}`}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CarouselPhonePreview({ cards }: { cards: CarouselCard[] }) {
  const [activeIdx, setActiveIdx] = useState(0);
  if (cards.length === 0) {
    return (
      <div className="mt2-phone-empty">
        <MessageSquare size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
        <span>Add carousel cards to see preview</span>
      </div>
    );
  }
  const card = cards[activeIdx] || cards[0];
  return (
    <div className="mt2-wa-chat">
      <div className="mt2-wa-chat-bar">
        <div className="mt2-wa-chat-back"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg></div>
        <div className="mt2-wa-chat-avatar"><MessageSquare size={14} /></div>
        <div className="mt2-wa-chat-name-col"><span className="mt2-wa-chat-name">Your Business</span><span className="mt2-wa-chat-status">online</span></div>
      </div>
      <div className="mt2-wa-chat-body">
        <div className="mt2-wa-carousel-bubble">
          <div className="mt2-wa-msg-tail" />
          {card.mediaUrl.trim() && (
            <div className="mt2-wa-media-wrap">
              {card.mediaFormat === 'IMAGE' && <img src={card.mediaUrl} alt="Card" className="mt2-wa-media-img" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
              {card.mediaFormat === 'VIDEO' && <video src={card.mediaUrl} className="mt2-wa-media-video" controls />}
            </div>
          )}
          {card.bodyText.trim() && <div className="mt2-wa-msg-body" style={{ paddingTop: 10 }}>{renderTextWithVars(card.bodyText, card.bodyExample ? [card.bodyExample] : [])}</div>}
          <div className="mt2-wa-msg-time">12:00 PM</div>
        </div>
        {card.buttons.length > 0 && (
          <div className="mt2-wa-msg-buttons">
            {card.buttons.map((btn, i) => (
              <div key={i} className="mt2-wa-msg-btn">
                {btn.type === 'URL' && <Link2 size={13} />}
                {btn.type === 'QUICK_REPLY' && <MessageSquare size={13} />}
                <span>{btn.text || `Button ${i + 1}`}</span>
              </div>
            ))}
          </div>
        )}
        {cards.length > 1 && (
          <div className="mt2-carousel-nav">
            <button type="button" onClick={() => setActiveIdx((activeIdx - 1 + cards.length) % cards.length)} disabled={activeIdx === 0}><ChevronLeft size={14} /></button>
            <div className="mt2-carousel-dots">
              {cards.map((_, i) => <button key={i} type="button" className={`mt2-carousel-dot ${i === activeIdx ? 'active' : ''}`} onClick={() => setActiveIdx(i)} />)}
            </div>
            <button type="button" onClick={() => setActiveIdx((activeIdx + 1) % cards.length)} disabled={activeIdx === cards.length - 1}><ChevronRight size={14} /></button>
          </div>
        )}
      </div>
    </div>
  );
}

function AuthPhonePreview({ body, addButtonType }: { body: string; addButtonType: 'COPY_CODE' | 'URL' | null }) {
  return (
    <div className="mt2-wa-chat">
      <div className="mt2-wa-chat-bar">
        <div className="mt2-wa-chat-back"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg></div>
        <div className="mt2-wa-chat-avatar"><MessageSquare size={14} /></div>
        <div className="mt2-wa-chat-name-col"><span className="mt2-wa-chat-name">Your Business</span><span className="mt2-wa-chat-status">online</span></div>
      </div>
      <div className="mt2-wa-chat-body">
        <div className="mt2-wa-msg-bubble">
          <div className="mt2-wa-msg-tail" />
          {body.trim() && <div className="mt2-wa-msg-body">{renderTextWithVars(body, ['123456'])}</div>}
          <div className="mt2-wa-msg-time">12:00 PM</div>
        </div>
        {addButtonType === 'COPY_CODE' && (
          <div className="mt2-wa-msg-buttons">
            <div className="mt2-wa-msg-btn"><Copy size={13} /><span>Copy code</span></div>
          </div>
        )}
        {addButtonType === 'URL' && (
          <div className="mt2-wa-msg-buttons">
            <div className="mt2-wa-msg-btn"><Link2 size={13} /><span>Visit Site</span></div>
            <div className="mt2-wa-msg-btn"><Copy size={13} /><span>Copy code</span></div>
          </div>
        )}
      </div>
    </div>
  );
}

function TemplateCard({ tpl, onEdit, onDelete, onSync, onClone, onTestSend, onAnalytics, onTranslate, onVersionHistory, onArchive, onHeatmap, selected, onSelect, syncing, testing, analyticsOpen }: {
  tpl: WaTemplate;
  onEdit: (t: WaTemplate) => void;
  onDelete: (t: WaTemplate) => void;
  onSync: (id: string) => void;
  onClone: (t: WaTemplate) => void;
  onTestSend: (t: WaTemplate) => void;
  onAnalytics: (t: WaTemplate) => void;
  onTranslate: (t: WaTemplate) => void;
  onVersionHistory: (t: WaTemplate) => void;
  onArchive: (t: WaTemplate) => void;
  onHeatmap: (t: WaTemplate) => void;
  selected: boolean;
  onSelect: (id: string) => void;
  syncing: boolean;
  testing: boolean;
  analyticsOpen: boolean;
}) {
  const sc = statusConfig[tpl.status] || statusConfig.PENDING;
  const cat = categoryConfig[tpl.category] || categoryConfig.UTILITY;
  const headerComp = tpl.components?.find((c: any) => c.type === 'HEADER');
  const bodyComp = tpl.components?.find((c: any) => c.type === 'BODY');
  const footerComp = tpl.components?.find((c: any) => c.type === 'FOOTER');
  const buttonsComp = tpl.components?.find((c: any) => c.type === 'BUTTONS');
  const carouselComp = tpl.components?.find((c: any) => c.type === 'CAROUSEL');
  const headerFormat: HeaderFormat = (headerComp?.format as HeaderFormat) || 'NONE';
  const bodyExamples: string[] = bodyComp?.example?.body_text?.[0] || [];
  const headerExample: string = headerComp?.example?.header_text?.[0] || '';
  const isAuth = tpl.category === 'AUTHENTICATION';
  const isCarousel = !!carouselComp;

  return (
    <div className={`mt2-tpl-card ${selected ? 'mt2-tpl-card-selected' : ''}`}>
      <div className="mt2-tpl-card-strip" style={{ background: sc.bg, color: sc.color }}>
        <label className="mt2-tpl-card-checkbox" onClick={(e) => e.stopPropagation()}>
          <input type="checkbox" checked={selected} onChange={() => onSelect(tpl.meta_template_id || '')} />
        </label>
        {sc.icon}
        <span>{sc.label}</span>
        {isCarousel && <span className="mt2-tpl-card-badge">Carousel</span>}
        {isAuth && <span className="mt2-tpl-card-badge">OTP</span>}
        {tpl.archived && <span className="mt2-tpl-card-badge mt2-tpl-card-badge-archived">Archived</span>}
        {tpl.rejection_reason && <span className="mt2-tpl-card-reject-icon" title={tpl.rejection_reason}><AlertTriangle size={12} /></span>}
      </div>

      <div className="mt2-tpl-card-preview">
        {isCarousel ? (
          <CarouselPhonePreview cards={(carouselComp.cards || []).map((c: any) => ({
            mediaFormat: c.format || 'IMAGE',
            mediaUrl: c.example?.header_handle?.[0] || '',
            bodyText: c.text || '',
            bodyExample: c.example?.body_text?.[0]?.[0] || '',
            buttons: (c.buttons || []).map((b: any) => ({ type: b.type, text: b.text || '' })),
          }))} />
        ) : (
          <WaPhonePreview
            headerFormat={headerFormat}
            headerText={headerComp?.text || ''}
            headerExample={headerExample}
            body={bodyComp?.text || ''}
            bodyExamples={bodyExamples}
            footer={footerComp?.text || ''}
            buttons={buttonsComp?.buttons?.map((b: any) => ({ type: b.type, text: b.text || '', url: b.url || '', phone: b.phone_number || '' })) || []}
            mediaUrl=""
          />
        )}
      </div>

      <div className="mt2-tpl-card-info">
        <div className="mt2-tpl-card-name-row">
          <strong className="mt2-tpl-card-name" title={tpl.name}>{tpl.name}</strong>
          <span className="mt2-tpl-card-cat" style={{ background: cat.bg, color: cat.color }}>{tpl.category}</span>
        </div>
        <div className="mt2-tpl-card-sub">
          <span className="mt2-tpl-card-lang">{tpl.language}</span>
          {headerFormat !== 'NONE' && <span className="mt2-tpl-card-format">{headerFormatConfig[headerFormat].icon}{headerFormat}</span>}
          {buttonsComp?.buttons?.length > 0 && <span className="mt2-tpl-card-btns-count"><MessageSquare size={11} />{buttonsComp.buttons.length}</span>}
        </div>
        {tpl.rejection_reason && <p className="mt2-tpl-card-rejection"><AlertTriangle size={11} /> {tpl.rejection_reason}</p>}
      </div>

      <div className="mt2-tpl-card-actions">
        {tpl.meta_template_id && (
          <>
            <button type="button" onClick={() => onSync(tpl.meta_template_id!)} disabled={syncing} className="mt2-action-btn mt2-action-btn-ghost" title="Sync status from Meta">
              {syncing ? <Loader2 size={12} className="crm-spin" /> : <RefreshCw size={12} />} Sync
            </button>
            <button type="button" onClick={() => onEdit(tpl)} className="mt2-action-btn mt2-action-btn-edit"><Pencil size={12} /> Edit</button>
            <button type="button" onClick={() => onClone(tpl)} className="mt2-action-btn mt2-action-btn-ghost" title="Duplicate template"><Copy size={12} /></button>
            <button type="button" onClick={() => onTranslate(tpl)} className="mt2-action-btn mt2-action-btn-ghost" title="Translate to other languages"><Languages size={12} /></button>
            {tpl.status === 'APPROVED' && (
              <button type="button" onClick={() => onTestSend(tpl)} disabled={testing} className="mt2-action-btn mt2-action-btn-send" title="Send test message">
                {testing ? <Loader2 size={12} className="crm-spin" /> : <Send size={12} />} Test
              </button>
            )}
            <button type="button" onClick={() => onAnalytics(tpl)} className={`mt2-action-btn ${analyticsOpen ? 'mt2-action-btn-edit' : 'mt2-action-btn-ghost'}`} title="View analytics"><BarChart3 size={12} /></button>
            <button type="button" onClick={() => onHeatmap(tpl)} className="mt2-action-btn mt2-action-btn-ghost" title="Performance heatmap"><Activity size={12} /></button>
            <button type="button" onClick={() => onVersionHistory(tpl)} className="mt2-action-btn mt2-action-btn-ghost" title="Version history"><History size={12} /></button>
            <button type="button" onClick={() => onArchive(tpl)} className="mt2-action-btn mt2-action-btn-ghost" title={tpl.archived ? 'Unarchive' : 'Archive'}><Archive size={12} /></button>
            <button type="button" onClick={() => onDelete(tpl)} className="mt2-action-btn mt2-action-btn-danger"><Trash2 size={12} /></button>
          </>
        )}
      </div>
    </div>
  );
}

function AnalyticsPanel({ template, onClose }: { template: WaTemplate; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<{ sent: number; delivered: number; read: number; clicked: number } | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true); setError('');
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) return;
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-templates?action=analytics&name=${encodeURIComponent(template.name)}`;
        const res = await fetch(apiUrl, { headers: { Authorization: `Bearer ${token}` } });
        const resData = await res.json();
        if (!res.ok || resData.error) { setError(resData.error || 'Failed to load analytics'); return; }
        setData(resData.analytics || { sent: 0, delivered: 0, read: 0, clicked: 0 });
      } catch { setError('Failed to load analytics'); }
      finally { setLoading(false); }
    })();
  }, [template.name]);

  const deliveryRate = data && data.sent > 0 ? ((data.delivered / data.sent) * 100).toFixed(1) : '0';
  const readRate = data && data.delivered > 0 ? ((data.read / data.delivered) * 100).toFixed(1) : '0';
  const clickRate = data && data.sent > 0 ? ((data.clicked / data.sent) * 100).toFixed(1) : '0';

  return (
    <div className="mt2-analytics-panel">
      <div className="mt2-analytics-header">
        <div className="mt2-analytics-title"><BarChart3 size={16} /><span>Analytics: {template.name}</span></div>
        <button onClick={onClose} className="mt2-analytics-close"><X size={16} /></button>
      </div>
      {loading ? (
        <div className="mt2-loading-state"><Loader2 size={24} className="crm-spin" style={{ color: '#25D366' }} /><p>Loading analytics...</p></div>
      ) : error ? (
        <div className="mt2-error-banner"><AlertTriangle size={16} /> {error}</div>
      ) : (
        <div className="mt2-analytics-grid">
          <div className="mt2-analytics-stat"><span className="mt2-analytics-num">{data?.sent || 0}</span><span className="mt2-analytics-label">Sent</span></div>
          <div className="mt2-analytics-stat"><span className="mt2-analytics-num">{data?.delivered || 0}</span><span className="mt2-analytics-label">Delivered ({deliveryRate}%)</span></div>
          <div className="mt2-analytics-stat"><span className="mt2-analytics-num">{data?.read || 0}</span><span className="mt2-analytics-label">Read ({readRate}%)</span></div>
          <div className="mt2-analytics-stat"><span className="mt2-analytics-num">{data?.clicked || 0}</span><span className="mt2-analytics-label">Clicked ({clickRate}%)</span></div>
        </div>
      )}
    </div>
  );
}

function TestSendModal({ template, phoneNumberId, onClose }: { template: WaTemplate; phoneNumberId: string; onClose: () => void }) {
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const bodyComp = template.components?.find((c: any) => c.type === 'BODY');
  const headerComp = template.components?.find((c: any) => c.type === 'HEADER');
  const bodyVars: number[] = (bodyComp?.text?.match(/\{\{(\d+)\}\}/g) || []).map((m: string) => parseInt(m.match(/\d+/)![0], 10));
  const uniqueVars = bodyVars.filter((value, index) => bodyVars.indexOf(value) === index).sort((a, b) => a - b);
  const headerVars: number[] = (headerComp?.format === 'TEXT' ? (headerComp?.text?.match(/\{\{(\d+)\}\}/g) || []) : []).map((m: string) => parseInt(m.match(/\d+/)![0], 10));
  const uniqueHeaderVars = headerVars.filter((value, index) => headerVars.indexOf(value) === index).sort((a, b) => a - b);
  const [varValues, setVarValues] = useState<string[]>(uniqueVars.map(() => ''));
  const [headerVarValues, setHeaderVarValues] = useState<string[]>(uniqueHeaderVars.map(() => ''));

  const handleSend = async () => {
    if (!phone.trim()) { setError('Phone number is required'); return; }
    if (uniqueVars.length > 0 && varValues.some((v) => !v.trim())) { setError('Please fill in all variable values'); return; }
    if (uniqueHeaderVars.length > 0 && headerVarValues.some((v) => !v.trim())) { setError('Please fill in all header variable values'); return; }
    setSending(true); setError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { setError('Not authenticated'); return; }
      const components: any[] = [];
      if (uniqueHeaderVars.length > 0) {
        components.push({ type: 'header', parameters: headerVarValues.map((v) => ({ type: 'text', text: v })) });
      }
      if (uniqueVars.length > 0) {
        components.push({ type: 'body', parameters: varValues.map((v) => ({ type: 'text', text: v })) });
      }
      const cleanPhone = phone.replace(/[\s\-()]/g, '');
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-templates?action=test_send&phone_number_id=${encodeURIComponent(phoneNumberId)}`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ template_name: template.name, language: template.language, phone_number: cleanPhone, components }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { setError(data.error || 'Failed to send'); return; }
      setSuccess(true);
    } catch { setError('Failed to send'); }
    finally { setSending(false); }
  };

  return (
    <div className="mt2-modal-overlay" onClick={onClose}>
      <div className="mt2-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="mt2-modal-header">
          <div className="mt2-modal-title"><Send size={18} /><span>Send Test Message</span></div>
          <button onClick={onClose} className="mt2-modal-close"><X size={18} /></button>
        </div>
        {success ? (
          <div className="mt2-modal-body">
            <div className="mt2-success-state"><CheckCircle2 size={40} style={{ color: '#25D366' }} /><p>Test message sent to {phone}!</p></div>
            <button onClick={onClose} className="mt2-submit-btn" style={{ width: '100%', justifyContent: 'center' }}>Done</button>
          </div>
        ) : (
          <div className="mt2-modal-body">
            <p className="mt2-modal-desc">Send a test of <strong>{template.name}</strong> to your WhatsApp number to see exactly how it looks.</p>
            <label className="mt2-field mt2-field-full">
              <span>Your Phone Number <em>*</em></span>
              <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1234567890" className="mt2-input" />
              <small className="mt2-field-hint">Include country code. e.g. +91 for India, +1 for US.</small>
            </label>
            {uniqueHeaderVars.length > 0 && (
              <div className="mt2-modal-vars">
                <span className="mt2-modal-vars-label">Header Variable Values:</span>
                {uniqueHeaderVars.map((v: number, i: number) => (
                  <input key={i} type="text" value={headerVarValues[i] || ''} onChange={(e) => { const nv = [...headerVarValues]; nv[i] = e.target.value; setHeaderVarValues(nv); }} placeholder={`Value for header {{${v}}}`} className="mt2-input" />
                ))}
              </div>
            )}
            {uniqueVars.length > 0 && (
              <div className="mt2-modal-vars">
                <span className="mt2-modal-vars-label">Variable Values:</span>
                {uniqueVars.map((v: number, i: number) => (
                  <input key={i} type="text" value={varValues[i] || ''} onChange={(e) => { const nv = [...varValues]; nv[i] = e.target.value; setVarValues(nv); }} placeholder={`Value for {{${v}}}`} className="mt2-input" />
                ))}
              </div>
            )}
            {error && <div className="mt2-error-banner"><AlertTriangle size={16} /> {error}</div>}
            <button onClick={handleSend} disabled={sending || !phone.trim()} className="mt2-submit-btn" style={{ width: '100%', justifyContent: 'center' }}>
              {sending ? <Loader2 size={14} className="crm-spin" /> : <Send size={14} />} Send Test
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TranslateModal({ template, onClose }: { template: WaTemplate; onClose: () => void }) {
  const [selectedLangs, setSelectedLangs] = useState<string[]>([]);
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<{ lang: string; success: boolean; error?: string }[]>([]);

  const toggleLang = (lang: string) => {
    setSelectedLangs((prev) => prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]);
  };

  const handleTranslate = async () => {
    if (selectedLangs.length === 0) return;
    setTranslating(true); setError(''); setResults([]);
    const bodyComp = template.components?.find((c: any) => c.type === 'BODY');
    const headerComp = template.components?.find((c: any) => c.type === 'HEADER');
    const footerComp = template.components?.find((c: any) => c.type === 'FOOTER');
    const buttonsComp = template.components?.find((c: any) => c.type === 'BUTTONS');
    const newResults: { lang: string; success: boolean; error?: string }[] = [];

    for (const lang of selectedLangs) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) { newResults.push({ lang, success: false, error: 'No auth' }); continue; }
        const sanitizedName = template.name + '_' + lang;
        const components = JSON.parse(JSON.stringify(template.components));
        components.forEach((c: any) => {
          if (c.type === 'BODY') { c.text = c.text + ' (' + lang + ')'; delete c.example; }
          if (c.type === 'HEADER' && c.format === 'TEXT') { c.text = c.text + ' (' + lang + ')'; delete c.example; }
        });
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-templates?action=create`;
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: sanitizedName, language: lang, category: template.category, components }),
        });
        const data = await res.json();
        if (!res.ok || data.error) { newResults.push({ lang, success: false, error: data.error || 'Failed' }); }
        else { newResults.push({ lang, success: true }); }
      } catch { newResults.push({ lang, success: false, error: 'Network error' }); }
    }
    setResults(newResults);
    setTranslating(false);
  };

  return (
    <div className="mt2-modal-overlay" onClick={onClose}>
      <div className="mt2-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="mt2-modal-header">
          <div className="mt2-modal-title"><Languages size={18} /><span>Translate Template</span></div>
          <button onClick={onClose} className="mt2-modal-close"><X size={18} /></button>
        </div>
        <div className="mt2-modal-body">
          <p className="mt2-modal-desc">Create copies of <strong>{template.name}</strong> in additional languages. Each will be submitted as a new template for Meta review.</p>
          {results.length === 0 ? (
            <>
              <div className="mt2-translate-list">
                {LANGUAGES.filter((l) => l.value !== template.language).map((l) => (
                  <label key={l.value} className={`mt2-translate-item ${selectedLangs.includes(l.value) ? 'checked' : ''}`}>
                    <input type="checkbox" checked={selectedLangs.includes(l.value)} onChange={() => toggleLang(l.value)} />
                    <span>{l.label}</span>
                  </label>
                ))}
              </div>
              {error && <div className="mt2-error-banner"><AlertTriangle size={16} /> {error}</div>}
              <button onClick={handleTranslate} disabled={translating || selectedLangs.length === 0} className="mt2-submit-btn" style={{ width: '100%', justifyContent: 'center' }}>
                {translating ? <Loader2 size={14} className="crm-spin" /> : <Languages size={14} />} Translate to {selectedLangs.length} language{selectedLangs.length !== 1 ? 's' : ''}
              </button>
            </>
          ) : (
            <>
              <div className="mt2-translate-results">
                {results.map((r, i) => (
                  <div key={i} className={`mt2-translate-result ${r.success ? 'success' : 'fail'}`}>
                    {r.success ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                    <span>{LANGUAGES.find((l) => l.value === r.lang)?.label || r.lang}</span>
                    {!r.success && <small>{r.error}</small>}
                  </div>
                ))}
              </div>
              <button onClick={onClose} className="mt2-submit-btn" style={{ width: '100%', justifyContent: 'center' }}>Done</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TemplateLibraryModal({ onClose, onImport }: { onClose: () => void; onImport: (tpl: typeof PREBUILT_TEMPLATES[0]) => void }) {
  const [search, setSearch] = useState('');
  const [filterTag, setFilterTag] = useState('all');
  const tags = [...new Set(PREBUILT_TEMPLATES.map((t) => t.tag))];
  const filtered = PREBUILT_TEMPLATES.filter((t) => {
    if (filterTag !== 'all' && t.tag !== filterTag) return false;
    if (search.trim() && !t.name.includes(search.toLowerCase()) && !t.body.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="mt2-modal-overlay" onClick={onClose}>
      <div className="mt2-modal-card mt2-modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="mt2-modal-header">
          <div className="mt2-modal-title"><Library size={18} /><span>Template Library</span></div>
          <button onClick={onClose} className="mt2-modal-close"><X size={18} /></button>
        </div>
        <div className="mt2-modal-body">
          <p className="mt2-modal-desc">Pick a pre-built template to customize and submit for Meta review. You can edit everything after importing.</p>
          <div className="mt2-library-filters">
            <div className="mt2-search-wrap"><Search size={16} className="mt2-search-icon" /><input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates..." className="mt2-search-input" /></div>
            <select value={filterTag} onChange={(e) => setFilterTag(e.target.value)} className="mt2-filter-select">
              <option value="all">All Categories</option>
              {tags.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="mt2-library-grid">
            {filtered.map((tpl, i) => (
              <div key={i} className="mt2-library-card">
                <div className="mt2-library-card-top">
                  <span className="mt2-library-card-tag">{tpl.tag}</span>
                  <span className="mt2-library-card-cat" style={{ background: categoryConfig[tpl.category]?.bg || 'rgba(8,145,178,0.1)', color: categoryConfig[tpl.category]?.color || '#0891B2' }}>{tpl.category}</span>
                </div>
                {tpl.header && <strong className="mt2-library-card-header">{tpl.header}</strong>}
                <p className="mt2-library-card-body">{tpl.body}</p>
                {tpl.footer && <small className="mt2-library-card-footer">{tpl.footer}</small>}
                {tpl.buttons && tpl.buttons.length > 0 && (
                  <div className="mt2-library-card-btns">
                    {tpl.buttons.map((b, bi) => <span key={bi} className="mt2-library-card-btn">{b.text}</span>)}
                  </div>
                )}
                <button className="mt2-submit-btn mt2-library-import-btn" onClick={() => onImport(tpl)}>
                  <Plus size={14} /> Use This Template
                </button>
              </div>
            ))}
          </div>
          {filtered.length === 0 && <div className="mt2-empty-state" style={{ padding: 40 }}><FileSearch size={36} style={{ opacity: 0.25, marginBottom: 8 }} /><p>No templates match your search</p></div>}
        </div>
      </div>
    </div>
  );
}

function LeaderboardPanel({ templates, onClose }: { templates: WaTemplate[]; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Record<string, { sent: number; delivered: number; read: number; clicked: number }>>({});
  const [sortBy, setSortBy] = useState<'sent' | 'delivery' | 'read' | 'clicked'>('sent');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) { setLoading(false); return; }
        const results: Record<string, { sent: number; delivered: number; read: number; clicked: number }> = {};
        for (const tpl of templates.filter((t) => t.status === 'APPROVED')) {
          try {
            const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-templates?action=analytics&name=${encodeURIComponent(tpl.name)}`;
            const res = await fetch(apiUrl, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            if (res.ok && data.analytics) results[tpl.name] = data.analytics;
            else results[tpl.name] = { sent: 0, delivered: 0, read: 0, clicked: 0 };
          } catch { results[tpl.name] = { sent: 0, delivered: 0, read: 0, clicked: 0 }; }
        }
        setStats(results);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, [templates]);

  const rows = Object.entries(stats).map(([name, s]) => ({
    name,
    ...s,
    deliveryRate: s.sent > 0 ? (s.delivered / s.sent) * 100 : 0,
    readRate: s.delivered > 0 ? (s.read / s.delivered) * 100 : 0,
    clickRate: s.sent > 0 ? (s.clicked / s.sent) * 100 : 0,
  })).sort((a, b) => {
    if (sortBy === 'sent') return b.sent - a.sent;
    if (sortBy === 'delivery') return b.deliveryRate - a.deliveryRate;
    if (sortBy === 'read') return b.readRate - a.readRate;
    return b.clickRate - a.clickRate;
  });

  const topPerformer = rows[0];

  return (
    <div className="mt2-modal-overlay" onClick={onClose}>
      <div className="mt2-modal-card mt2-modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="mt2-modal-header">
          <div className="mt2-modal-title"><TrendingUp size={18} /><span>Template Performance Leaderboard</span></div>
          <button onClick={onClose} className="mt2-modal-close"><X size={18} /></button>
        </div>
        <div className="mt2-modal-body">
          {loading ? (
            <div className="mt2-loading-state"><Loader2 size={24} className="crm-spin" style={{ color: '#25D366' }} /><p>Loading performance data...</p></div>
          ) : rows.length === 0 ? (
            <div className="mt2-empty-state"><BarChart3 size={40} style={{ opacity: 0.25, marginBottom: 10 }} /><h3>No approved templates yet</h3><p>Create and approve templates to see performance comparisons.</p></div>
          ) : (
            <>
              {topPerformer && topPerformer.sent > 0 && (
                <div className="mt2-leaderboard-top">
                  <Award size={20} style={{ color: '#F59E0B' }} />
                  <div>
                    <strong>Top Performer: {topPerformer.name}</strong>
                    <span>{topPerformer.sent} sent · {topPerformer.deliveryRate.toFixed(0)}% delivery · {topPerformer.readRate.toFixed(0)}% read rate</span>
                  </div>
                </div>
              )}
              <div className="mt2-leaderboard-sort">
                <span>Sort by:</span>
                {(['sent', 'delivery', 'read', 'clicked'] as const).map((s) => (
                  <button key={s} className={`mt2-leaderboard-sort-btn ${sortBy === s ? 'active' : ''}`} onClick={() => setSortBy(s)}>
                    {s === 'sent' ? 'Most Sent' : s === 'delivery' ? 'Delivery Rate' : s === 'read' ? 'Read Rate' : 'Click Rate'}
                  </button>
                ))}
              </div>
              <div className="mt2-leaderboard-table">
                <div className="mt2-leaderboard-row mt2-leaderboard-header-row">
                  <span>Rank</span><span>Template</span><span>Sent</span><span>Delivery</span><span>Read</span><span>Clicked</span>
                </div>
                {rows.map((r, i) => (
                  <div key={r.name} className="mt2-leaderboard-row">
                    <span className="mt2-leaderboard-rank">{i === 0 ? <Award size={14} style={{ color: '#F59E0B' }} /> : i + 1}</span>
                    <span className="mt2-leaderboard-name">{r.name}</span>
                    <span>{r.sent}</span>
                    <span className={r.deliveryRate > 90 ? 'mt2-leaderboard-good' : r.deliveryRate < 70 ? 'mt2-leaderboard-bad' : ''}>{r.deliveryRate.toFixed(1)}%</span>
                    <span className={r.readRate > 50 ? 'mt2-leaderboard-good' : ''}>{r.readRate.toFixed(1)}%</span>
                    <span>{r.clicked}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function VersionHistoryModal({ template, onClose, onRestore }: { template: WaTemplate; onClose: () => void; onRestore: (components: any[]) => void }) {
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true); setError('');
      try {
        const { data, error: err } = await supabase
          .from('wa_template_versions')
          .select('*')
          .eq('template_id', template.meta_template_id)
          .order('version_number', { ascending: false });
        if (err) throw err;
        setVersions(data || []);
      } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load versions'); }
      finally { setLoading(false); }
    })();
  }, [template]);

  return (
    <div className="mt2-modal-overlay" onClick={onClose}>
      <div className="mt2-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="mt2-modal-header">
          <div className="mt2-modal-title"><History size={18} /><span>Version History: {template.name}</span></div>
          <button onClick={onClose} className="mt2-modal-close"><X size={18} /></button>
        </div>
        <div className="mt2-modal-body">
          {loading ? (
            <div className="mt2-loading-state"><Loader2 size={24} className="crm-spin" style={{ color: '#25D366' }} /><p>Loading versions...</p></div>
          ) : error ? (
            <div className="mt2-error-banner"><AlertTriangle size={16} /> {error}</div>
          ) : versions.length === 0 ? (
            <div className="mt2-empty-state"><History size={40} style={{ opacity: 0.25, marginBottom: 10 }} /><h3>No version history yet</h3><p>Version snapshots are saved automatically when you edit a template.</p></div>
          ) : (
            <div className="mt2-version-list">
              {versions.map((v) => {
                const bodyComp = v.components?.find((c: any) => c.type === 'BODY');
                return (
                  <div key={v.id} className="mt2-version-item">
                    <div className="mt2-version-info">
                      <span className="mt2-version-num">v{v.version_number}</span>
                      <span className="mt2-version-date">{new Date(v.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      {v.changed_by && <span className="mt2-version-change">{v.changed_by}</span>}
                    </div>
                    <p className="mt2-version-preview">{(bodyComp?.text || '').slice(0, 120)}{(bodyComp?.text || '').length > 120 ? '...' : ''}</p>
                    <button className="mt2-action-btn mt2-action-btn-ghost" onClick={() => onRestore(v.components)}>Restore</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ABTestModal({ approvedTemplates, onClose, onSave }: { approvedTemplates: WaTemplate[]; onClose: () => void; onSave: (test: { name: string; variant_a_template: string; variant_b_template: string; variant_a_language: string; variant_b_language: string; split_percentage: number }) => Promise<void> }) {
  const [name, setName] = useState('');
  const [variantA, setVariantA] = useState('');
  const [variantB, setVariantB] = useState('');
  const [langA, setLangA] = useState('en_US');
  const [langB, setLangB] = useState('en_US');
  const [split, setSplit] = useState(50);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) { setError('Test name is required'); return; }
    if (!variantA || !variantB) { setError('Both variants must be selected'); return; }
    if (variantA === variantB && langA === langB) { setError('Variants must be different'); return; }
    setSaving(true); setError('');
    try {
      await onSave({ name: name.trim(), variant_a_template: variantA, variant_b_template: variantB, variant_a_language: langA, variant_b_language: langB, split_percentage: split });
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to create test'); }
    finally { setSaving(false); }
  };

  return (
    <div className="mt2-modal-overlay" onClick={onClose}>
      <div className="mt2-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="mt2-modal-header">
          <div className="mt2-modal-title"><FlaskConical size={18} /><span>Create A/B Test</span></div>
          <button onClick={onClose} className="mt2-modal-close"><X size={18} /></button>
        </div>
        <div className="mt2-modal-body">
          <p className="mt2-modal-desc">Compare two template variants to see which performs better. Split your audience and track delivery, read, and click rates.</p>
          <label className="mt2-field mt2-field-full">
            <span>Test Name <em>*</em></span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Welcome Message A/B Test" className="mt2-input" />
          </label>
          <div className="mt2-abtest-variants">
            <div className="mt2-abtest-variant">
              <span className="mt2-abtest-variant-label">Variant A</span>
              <select value={variantA} onChange={(e) => { setVariantA(e.target.value); const tpl = approvedTemplates.find((t) => t.name === e.target.value); if (tpl) setLangA(tpl.language); }} className="mt2-select">
                <option value="">Select template...</option>
                {approvedTemplates.map((t) => <option key={t.name} value={t.name}>{t.name} ({t.language})</option>)}
              </select>
              <select value={langA} onChange={(e) => setLangA(e.target.value)} className="mt2-select">
                {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
            <div className="mt2-abtest-variant">
              <span className="mt2-abtest-variant-label">Variant B</span>
              <select value={variantB} onChange={(e) => { setVariantB(e.target.value); const tpl = approvedTemplates.find((t) => t.name === e.target.value); if (tpl) setLangB(tpl.language); }} className="mt2-select">
                <option value="">Select template...</option>
                {approvedTemplates.map((t) => <option key={t.name} value={t.name}>{t.name} ({t.language})</option>)}
              </select>
              <select value={langB} onChange={(e) => setLangB(e.target.value)} className="mt2-select">
                {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
          </div>
          <div className="mt2-field mt2-field-full">
            <span>Traffic Split: {split}% to Variant A · {100 - split}% to Variant B</span>
            <input type="range" min="10" max="90" step="10" value={split} onChange={(e) => setSplit(parseInt(e.target.value))} className="mt2-abtest-slider" />
          </div>
          {error && <div className="mt2-error-banner"><AlertTriangle size={16} /> {error}</div>}
          <button onClick={handleSave} disabled={saving || !name.trim() || !variantA || !variantB} className="mt2-submit-btn" style={{ width: '100%', justifyContent: 'center' }}>
            {saving ? <Loader2 size={14} className="crm-spin" /> : <Rocket size={14} />} Create A/B Test
          </button>
        </div>
      </div>
    </div>
  );
}

function ABTestListPanel({ onClose, onRefresh }: { onClose: () => void; onRefresh: () => void }) {
  const [tests, setTests] = useState<ABTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchTests = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data, error: err } = await supabase.from('wa_ab_tests').select('*').order('created_at', { ascending: false });
      if (err) throw err;
      setTests(data || []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load tests'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTests(); }, [fetchTests]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this A/B test?')) return;
    await supabase.from('wa_ab_tests').delete().eq('id', id);
    fetchTests(); onRefresh();
  };

  return (
    <div className="mt2-modal-overlay" onClick={onClose}>
      <div className="mt2-modal-card mt2-modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="mt2-modal-header">
          <div className="mt2-modal-title"><FlaskConical size={18} /><span>A/B Tests</span></div>
          <button onClick={onClose} className="mt2-modal-close"><X size={18} /></button>
        </div>
        <div className="mt2-modal-body">
          {loading ? (
            <div className="mt2-loading-state"><Loader2 size={24} className="crm-spin" style={{ color: '#25D366' }} /><p>Loading A/B tests...</p></div>
          ) : error ? (
            <div className="mt2-error-banner"><AlertTriangle size={16} /> {error}</div>
          ) : tests.length === 0 ? (
            <div className="mt2-empty-state"><FlaskConical size={40} style={{ opacity: 0.25, marginBottom: 10 }} /><h3>No A/B tests yet</h3><p>Create an A/B test to compare two template variants.</p></div>
          ) : (
            <div className="mt2-abtest-list">
              {tests.map((t) => {
                const deliveryA = t.total_sent_a > 0 ? (t.delivered_a / t.total_sent_a) * 100 : 0;
                const deliveryB = t.total_sent_b > 0 ? (t.delivered_b / t.total_sent_b) * 100 : 0;
                const readA = t.delivered_a > 0 ? (t.read_a / t.delivered_a) * 100 : 0;
                const readB = t.delivered_b > 0 ? (t.read_b / t.delivered_b) * 100 : 0;
                return (
                  <div key={t.id} className="mt2-abtest-card">
                    <div className="mt2-abtest-card-header">
                      <div>
                        <strong>{t.name}</strong>
                        <span className={`mt2-abtest-status mt2-abtest-status-${t.status}`}>{t.status}</span>
                        {t.winner && <span className="mt2-abtest-winner">Winner: {t.winner}</span>}
                      </div>
                      <button onClick={() => handleDelete(t.id)} className="mt2-action-btn mt2-action-btn-danger"><Trash2 size={12} /></button>
                    </div>
                    <div className="mt2-abtest-comparison">
                      <div className={`mt2-abtest-col ${t.winner === 'A' ? 'winner' : ''}`}>
                        <span className="mt2-abtest-col-label">Variant A {t.winner === 'A' && <Award size={12} />}</span>
                        <strong>{t.variant_a_template}</strong>
                        <div className="mt2-abtest-metrics">
                          <span>Sent: {t.total_sent_a}</span>
                          <span>Delivery: {deliveryA.toFixed(0)}%</span>
                          <span>Read: {readA.toFixed(0)}%</span>
                          <span>Clicks: {t.clicked_a}</span>
                        </div>
                      </div>
                      <div className="mt2-abtest-vs">VS</div>
                      <div className={`mt2-abtest-col ${t.winner === 'B' ? 'winner' : ''}`}>
                        <span className="mt2-abtest-col-label">Variant B {t.winner === 'B' && <Award size={12} />}</span>
                        <strong>{t.variant_b_template}</strong>
                        <div className="mt2-abtest-metrics">
                          <span>Sent: {t.total_sent_b}</span>
                          <span>Delivery: {deliveryB.toFixed(0)}%</span>
                          <span>Read: {readB.toFixed(0)}%</span>
                          <span>Clicks: {t.clicked_b}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TagManagerModal({ onClose, tags, onAddTag, onDeleteTag }: { onClose: () => void; tags: TemplateTag[]; onAddTag: (name: string, color: string) => Promise<void>; onDeleteTag: (id: string) => Promise<void> }) {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#25D366');
  const [adding, setAdding] = useState(false);
  const colors = ['#25D366', '#0891B2', '#C2410C', '#7C3AED', '#F59E0B', '#EF4444', '#3B82F6', '#10B981'];

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try { await onAddTag(newName.trim(), newColor); setNewName(''); }
    catch { /* ignore */ }
    finally { setAdding(false); }
  };

  return (
    <div className="mt2-modal-overlay" onClick={onClose}>
      <div className="mt2-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="mt2-modal-header">
          <div className="mt2-modal-title"><TagIcon size={18} /><span>Manage Tags</span></div>
          <button onClick={onClose} className="mt2-modal-close"><X size={18} /></button>
        </div>
        <div className="mt2-modal-body">
          <p className="mt2-modal-desc">Organize templates into folders with colored tags for easy filtering.</p>
          <div className="mt2-tag-add-row">
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Tag name (e.g. Festival Offers)" className="mt2-input" />
            <div className="mt2-tag-color-picker">
              {colors.map((c) => <button key={c} className={`mt2-tag-color-dot ${newColor === c ? 'active' : ''}`} style={{ background: c }} onClick={() => setNewColor(c)} />)}
            </div>
            <button onClick={handleAdd} disabled={adding || !newName.trim()} className="mt2-submit-btn"><Plus size={14} /> Add</button>
          </div>
          <div className="mt2-tag-list">
            {tags.length === 0 ? (
              <div className="mt2-empty-state" style={{ padding: 20 }}><Tags size={28} style={{ opacity: 0.25, marginBottom: 6 }} /><p>No tags created yet</p></div>
            ) : tags.map((t) => (
              <div key={t.id} className="mt2-tag-item">
                <span className="mt2-tag-dot" style={{ background: t.color }} />
                <span className="mt2-tag-name">{t.name}</span>
                {t.count !== undefined && <span className="mt2-tag-count">{t.count} templates</span>}
                <button onClick={() => onDeleteTag(t.id)} className="mt2-btn-remove"><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ComplianceChecker({ body, category, footer, header }: { body: string; category: string; footer: string; header: string }) {
  const result = checkCompliance(body, category, footer, header);
  const errors = result.warnings.filter((w) => w.type === 'error');
  const warnings = result.warnings.filter((w) => w.type === 'warning');
  const infos = result.warnings.filter((w) => w.type === 'info');

  return (
    <div className="mt2-compliance-panel">
      <div className="mt2-compliance-header">
        <ShieldCheck size={16} style={{ color: result.passed ? '#16a34a' : '#dc2626' }} />
        <span style={{ color: result.passed ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
          {result.passed ? 'Compliance Check Passed' : `${errors.length} Issue(s) Found`}
        </span>
      </div>
      {result.warnings.length > 0 && (
        <div className="mt2-compliance-list">
          {errors.map((w, i) => (
            <div key={`e${i}`} className="mt2-compliance-item mt2-compliance-error"><AlertCircle size={14} /> {w.message}</div>
          ))}
          {warnings.map((w, i) => (
            <div key={`w${i}`} className="mt2-compliance-item mt2-compliance-warning"><AlertTriangle size={14} /> {w.message}</div>
          ))}
          {infos.map((w, i) => (
            <div key={`i${i}`} className="mt2-compliance-item mt2-compliance-info"><Info size={14} /> {w.message}</div>
          ))}
        </div>
      )}
      {result.warnings.length === 0 && (
        <div className="mt2-compliance-item mt2-compliance-success"><CheckCircle2 size={14} /> No issues detected. This template should pass Meta review.</div>
      )}
    </div>
  );
}

function ImportExportModal({ templates, onClose, onImport }: { templates: WaTemplate[]; onClose: () => void; onImport: (templates: any[]) => Promise<void> }) {
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const data = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), templates }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wa_templates_backup_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file: File) => {
    setImporting(true); setError(''); setSuccess('');
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed.templates || !Array.isArray(parsed.templates)) { setError('Invalid file format. Expected a JSON with a "templates" array.'); return; }
      await onImport(parsed.templates);
      setSuccess(`Successfully imported ${parsed.templates.length} template(s) into the editor.`);
    } catch { setError('Failed to parse file. Make sure it is a valid JSON export.'); }
    finally { setImporting(false); }
  };

  return (
    <div className="mt2-modal-overlay" onClick={onClose}>
      <div className="mt2-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="mt2-modal-header">
          <div className="mt2-modal-title"><Download size={18} /><span>Import / Export Templates</span></div>
          <button onClick={onClose} className="mt2-modal-close"><X size={18} /></button>
        </div>
        <div className="mt2-modal-body">
          <p className="mt2-modal-desc">Export all your templates as a JSON file for backup or migration. Import a previously exported file to restore templates.</p>
          <div className="mt2-importexport-section">
            <div className="mt2-importexport-card">
              <FileJson size={28} style={{ color: '#25D366', marginBottom: 8 }} />
              <strong>Export Templates</strong>
              <span>Download all {templates.length} templates as a JSON backup file.</span>
              <button className="mt2-submit-btn" onClick={handleExport} disabled={templates.length === 0}><Download size={14} /> Export ({templates.length})</button>
            </div>
            <div className="mt2-importexport-card">
              <UploadIcon size={28} style={{ color: '#0891B2', marginBottom: 8 }} />
              <strong>Import Templates</strong>
              <span>Upload a JSON file to import templates into the editor one by one.</span>
              <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); }} />
              <button className="mt2-submit-btn" onClick={() => fileRef.current?.click()} disabled={importing}>{importing ? <Loader2 size={14} className="crm-spin" /> : <UploadIcon size={14} />} Choose File</button>
            </div>
          </div>
          {error && <div className="mt2-error-banner"><AlertTriangle size={16} /> {error}</div>}
          {success && <div className="mt2-compliance-item mt2-compliance-success"><CheckCircle2 size={14} /> {success}</div>}
        </div>
      </div>
    </div>
  );
}

function UsageDashboard({ templates, onClose }: { templates: WaTemplate[]; onClose: () => void }) {
  const [stats, setStats] = useState<Record<string, { sent: number; campaigns: number; lastUsed: string | null }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: campaigns } = await supabase.from('wa_broadcast_campaigns').select('template_name, status, total_recipients, created_at');
        const map: Record<string, { sent: number; campaigns: number; lastUsed: string | null }> = {};
        (campaigns || []).forEach((c: any) => {
          const key = c.template_name;
          if (!map[key]) map[key] = { sent: 0, campaigns: 0, lastUsed: null };
          map[key].sent += c.total_recipients || 0;
          map[key].campaigns += 1;
          if (!map[key].lastUsed || c.created_at > map[key].lastUsed) map[key].lastUsed = c.created_at;
        });
        setStats(map);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, []);

  const usedTemplates = Object.entries(stats).sort((a, b) => b[1].sent - a[1].sent);
  const totalSent = usedTemplates.reduce((sum, [, s]) => sum + s.sent, 0);
  const totalCampaigns = usedTemplates.reduce((sum, [, s]) => sum + s.campaigns, 0);
  const unusedApproved = templates.filter((t) => t.status === 'APPROVED' && !stats[t.name]);

  return (
    <div className="mt2-modal-overlay" onClick={onClose}>
      <div className="mt2-modal-card mt2-modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="mt2-modal-header">
          <div className="mt2-modal-title"><Activity size={18} /><span>Template Usage Dashboard</span></div>
          <button onClick={onClose} className="mt2-modal-close"><X size={18} /></button>
        </div>
        <div className="mt2-modal-body">
          {loading ? (
            <div className="mt2-loading-state"><Loader2 size={24} className="crm-spin" style={{ color: '#25D366' }} /><p>Loading usage data...</p></div>
          ) : (
            <>
              <div className="mt2-usage-summary">
                <div className="mt2-usage-stat"><Activity size={18} /><strong>{totalSent.toLocaleString()}</strong><span>Total Messages Sent</span></div>
                <div className="mt2-usage-stat"><Layers size={18} /><strong>{totalCampaigns}</strong><span>Total Campaigns</span></div>
                <div className="mt2-usage-stat"><CheckCircle2 size={18} /><strong>{usedTemplates.length}</strong><span>Templates In Use</span></div>
                <div className="mt2-usage-stat"><AlertCircle size={18} style={{ color: '#F59E0B' }} /><strong>{unusedApproved.length}</strong><span>Unused Approved</span></div>
              </div>
              {unusedApproved.length > 0 && (
                <div className="mt2-usage-warn">
                  <AlertCircle size={14} />
                  <span>{unusedApproved.length} approved template(s) have never been used. Meta may deactivate templates unused for 30+ days.</span>
                </div>
              )}
              <h3 className="mt2-usage-section-title">Most Used Templates</h3>
              <div className="mt2-usage-list">
                {usedTemplates.length === 0 ? (
                  <div className="mt2-empty-state"><Activity size={36} style={{ opacity: 0.25, marginBottom: 8 }} /><p>No broadcast campaigns yet. Usage data will appear here after you send your first broadcast.</p></div>
                ) : usedTemplates.slice(0, 15).map(([name, s]) => {
                  const maxSent = usedTemplates[0]?.[1].sent || 1;
                  const barWidth = (s.sent / maxSent) * 100;
                  return (
                    <div key={name} className="mt2-usage-row">
                      <span className="mt2-usage-name">{name}</span>
                      <div className="mt2-usage-bar-wrap"><div className="mt2-usage-bar" style={{ width: `${barWidth}%` }} /></div>
                      <span className="mt2-usage-sent">{s.sent.toLocaleString()} sent</span>
                      <span className="mt2-usage-campaigns">{s.campaigns} campaign{s.campaigns !== 1 ? 's' : ''}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function VariableMapper({ body, onMap }: { body: string; onMap: (varIndex: number, field: string) => void }) {
  const vars = [...new Set((body.match(/\{\{(\d+)\}\}/g) || []).map((m) => parseInt(m.match(/\d+/)![0], 10)))].sort((a, b) => a - b);
  const [mappings, setMappings] = useState<Record<number, string>>({});

  if (vars.length === 0) return null;

  const handleChange = (varNum: number, field: string) => {
    setMappings((prev) => ({ ...prev, [varNum]: field }));
    onMap(varNum, field);
  };

  return (
    <div className="mt2-varmapper-panel">
      <div className="mt2-varmapper-title"><GitBranch size={14} /><span>Variable Field Mapping</span></div>
      <p className="mt2-varmapper-desc">Map each variable to a lead field for faster broadcast setup.</p>
      <div className="mt2-varmapper-list">
        {vars.map((v) => (
          <div key={v} className="mt2-varmapper-row">
            <span className="mt2-varmapper-var">{'{{' + v + '}}'}</span>
            <ChevronRight size={12} style={{ color: '#94a3b8' }} />
            <select value={mappings[v] || ''} onChange={(e) => handleChange(v, e.target.value)} className="mt2-select">
              <option value="">Select a field...</option>
              {LEAD_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label} (e.g. {f.example})</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

function DuplicateDetectionModal({ templates, onClose }: { templates: WaTemplate[]; onClose: () => void }) {
  const duplicates: { existing: WaTemplate; newBody: string; similarity: number }[] = [];
  for (let i = 0; i < templates.length; i++) {
    for (let j = i + 1; j < templates.length; j++) {
      const bodyA = templates[i].components?.find((c: any) => c.type === 'BODY')?.text || '';
      const bodyB = templates[j].components?.find((c: any) => c.type === 'BODY')?.text || '';
      const normA = normalizeForComparison(bodyA);
      const normB = normalizeForComparison(bodyB);
      if (normA === normB && normA.length > 0) {
        duplicates.push({ existing: templates[j], newBody: bodyA, similarity: 100 });
      } else if (normA.length > 20 && normB.length > 20) {
        const wordsA = normA.split(' ');
        const wordsB = normB.split(' ');
        const common = wordsA.filter((w) => wordsB.includes(w)).length;
        const similarity = Math.round((common / Math.max(wordsA.length, wordsB.length)) * 100);
        if (similarity >= 80) {
          duplicates.push({ existing: templates[j], newBody: bodyA, similarity });
        }
      }
    }
  }

  return (
    <div className="mt2-modal-overlay" onClick={onClose}>
      <div className="mt2-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="mt2-modal-header">
          <div className="mt2-modal-title"><ClipboardCheck size={18} /><span>Duplicate Detection</span></div>
          <button onClick={onClose} className="mt2-modal-close"><X size={18} /></button>
        </div>
        <div className="mt2-modal-body">
          <p className="mt2-modal-desc">Scans all your templates for duplicate or near-duplicate body text that could cause Meta rejections.</p>
          {duplicates.length === 0 ? (
            <div className="mt2-compliance-item mt2-compliance-success"><CheckCircle2 size={14} /> No duplicate templates detected. Your templates are unique.</div>
          ) : (
            <div className="mt2-duplicate-list">
              {duplicates.map((d, i) => (
                <div key={i} className="mt2-duplicate-item">
                  <div className="mt2-duplicate-info">
                    <span className="mt2-duplicate-similarity" style={{ color: d.similarity === 100 ? '#dc2626' : '#F59E0B' }}>{d.similarity}% match</span>
                    <strong>{d.existing.name}</strong>
                  </div>
                  <p className="mt2-duplicate-body">{d.newBody.slice(0, 120)}{d.newBody.length > 120 ? '...' : ''}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ExpiryWarningsPanel({ templates, onClose }: { templates: WaTemplate[]; onClose: () => void }) {
  const [stats, setStats] = useState<Record<string, { lastUsed: string | null }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: campaigns } = await supabase.from('wa_broadcast_campaigns').select('template_name, created_at').order('created_at', { ascending: false });
        const map: Record<string, { lastUsed: string | null }> = {};
        (campaigns || []).forEach((c: any) => {
          if (!map[c.template_name]) map[c.template_name] = { lastUsed: c.created_at };
        });
        setStats(map);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, []);

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const atRisk = templates.filter((t) => t.status === 'APPROVED' && !t.archived).map((t) => {
    const lastUsed = stats[t.name]?.lastUsed;
    const lastDate = lastUsed ? new Date(lastUsed) : null;
    const daysSince = lastDate ? Math.floor((now.getTime() - lastDate.getTime()) / (24 * 60 * 60 * 1000)) : null;
    return { template: t, daysSince, lastUsed };
  }).filter((item) => item.daysSince === null || item.daysSince >= 20).sort((a, b) => (a.daysSince ?? 999) - (b.daysSince ?? 999));

  return (
    <div className="mt2-modal-overlay" onClick={onClose}>
      <div className="mt2-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="mt2-modal-header">
          <div className="mt2-modal-title"><CalendarClock size={18} /><span>Template Expiry Warnings</span></div>
          <button onClick={onClose} className="mt2-modal-close"><X size={18} /></button>
        </div>
        <div className="mt2-modal-body">
          <p className="mt2-modal-desc">Meta deactivates templates unused for 30+ days. Templates below are at risk of expiry.</p>
          {loading ? (
            <div className="mt2-loading-state"><Loader2 size={24} className="crm-spin" style={{ color: '#25D366' }} /><p>Loading expiry data...</p></div>
          ) : atRisk.length === 0 ? (
            <div className="mt2-compliance-item mt2-compliance-success"><CheckCircle2 size={14} /> All your approved templates have been used recently. No expiry risk detected.</div>
          ) : (
            <div className="mt2-expiry-list">
              {atRisk.map((item) => (
                <div key={item.template.name} className={`mt2-expiry-item ${item.daysSince === null ? 'mt2-expiry-critical' : item.daysSince >= 25 ? 'mt2-expiry-critical' : 'mt2-expiry-warning'}`}>
                  <div className="mt2-expiry-info">
                    <strong>{item.template.name}</strong>
                    <span>{item.daysSince === null ? 'Never used' : `Last used ${item.daysSince} days ago`}</span>
                  </div>
                  <span className={`mt2-expiry-badge ${item.daysSince === null || item.daysSince >= 25 ? 'mt2-expiry-badge-critical' : ''}`}>
                    {item.daysSince === null ? 'Never Used' : item.daysSince >= 30 ? 'Expired' : `${30 - item.daysSince}d left`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LanguageGroupView({ templates, onEdit, onClose }: { templates: WaTemplate[]; onEdit: (t: WaTemplate) => void; onClose: () => void }) {
  const groups: Record<string, WaTemplate[]> = {};
  templates.filter((t) => !t.archived).forEach((t) => {
    const baseName = t.name.replace(/_[a-z]{2}(_[A-Z]{2})?$/, '');
    if (!groups[baseName]) groups[baseName] = [];
    groups[baseName].push(t);
  });
  const multiLangGroups = Object.entries(groups).filter(([, tpls]) => tpls.length > 1).sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="mt2-modal-overlay" onClick={onClose}>
      <div className="mt2-modal-card mt2-modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="mt2-modal-header">
          <div className="mt2-modal-title"><Globe size={18} /><span>Multi-Language Groups</span></div>
          <button onClick={onClose} className="mt2-modal-close"><X size={18} /></button>
        </div>
        <div className="mt2-modal-body">
          <p className="mt2-modal-desc">Templates with the same base name but different languages are grouped together for easy management.</p>
          {multiLangGroups.length === 0 ? (
            <div className="mt2-empty-state"><Globe size={36} style={{ opacity: 0.25, marginBottom: 8 }} /><p>No multi-language template groups found.</p><p style={{ fontSize: '0.78rem' }}>Use the Translate feature to create language variants of your templates.</p></div>
          ) : (
            <div className="mt2-langgroups-list">
              {multiLangGroups.map(([baseName, tpls]) => (
                <div key={baseName} className="mt2-langgroup-card">
                  <div className="mt2-langgroup-header">
                    <Globe size={16} style={{ color: '#25D366' }} />
                    <strong>{baseName}</strong>
                    <span className="mt2-langgroup-count">{tpls.length} languages</span>
                  </div>
                  <div className="mt2-langgroup-langs">
                    {tpls.sort((a, b) => a.language.localeCompare(b.language)).map((t) => {
                      const langLabel = LANGUAGES.find((l) => l.value === t.language)?.label || t.language;
                      return (
                        <div key={t.meta_template_id} className="mt2-langgroup-lang-item" onClick={() => onEdit(t)}>
                          <span className="mt2-langgroup-lang-label">{langLabel}</span>
                          <span className={`mt2-langgroup-status mt2-langgroup-status-${t.status.toLowerCase()}`}>{t.status}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AiTemplateGeneratorModal({ onClose, onApply }: { onClose: () => void; onApply: (tpl: { name: string; header: string; body: string; footer: string; bodyExamples: string[]; headerExample: string; buttons: { type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'; text: string; url?: string }[] }) => void }) {
  const [goal, setGoal] = useState('');
  const [category, setCategory] = useState('MARKETING');
  const [language, setLanguage] = useState('en_US');
  const [tone, setTone] = useState('professional');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);

  const handleGenerate = async () => {
    if (!goal.trim()) { setError('Please describe what you want the template to accomplish'); return; }
    setGenerating(true); setError(''); setResult(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { setError('Not authenticated'); return; }
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-templates?action=ai_generate`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ goal: goal.trim(), category, language, tone }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { setError(data.error || 'Generation failed'); return; }
      setResult(data.template);
    } catch { setError('Failed to generate template'); }
    finally { setGenerating(false); }
  };

  const handleApply = () => {
    if (!result) return;
    onApply({
      name: result.name || '',
      header: result.header || '',
      body: result.body || '',
      footer: result.footer || '',
      bodyExamples: result.bodyExamples || [],
      headerExample: result.headerExample || '',
      buttons: (result.buttons || []).map((b: any) => ({ type: b.type || 'QUICK_REPLY', text: b.text || '', url: b.url || '' })),
    });
    onClose();
  };

  const goalSuggestions = [
    'Re-engage cold leads who haven\'t responded in 7 days',
    'Welcome new leads and introduce our trading platform',
    'Remind leads about their upcoming appointment',
    'Send a limited-time festival discount offer',
    'Ask for feedback after a successful conversion',
  ];

  return (
    <div className="mt2-modal-overlay" onClick={onClose}>
      <div className="mt2-modal-card mt2-modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="mt2-modal-header">
          <div className="mt2-modal-title"><Sparkles size={18} /><span>AI Template Generator</span></div>
          <button onClick={onClose} className="mt2-modal-close"><X size={18} /></button>
        </div>
        <div className="mt2-modal-body">
          {!result ? (
            <>
              <p className="mt2-modal-desc">Describe what you want the template to do, and the AI will draft a complete WhatsApp template with header, body, footer, buttons, and example values — ready to submit for Meta review.</p>
              <label className="mt2-field mt2-field-full">
                <span>What should this template do? <em>*</em></span>
                <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={3} placeholder="e.g. Re-engage cold leads for a trading platform with a special offer" className="mt2-textarea" />
              </label>
              <div className="mt2-ai-suggestions">
                {goalSuggestions.map((s, i) => (
                  <button key={i} className="mt2-ai-suggestion-chip" onClick={() => setGoal(s)}><Sparkles size={11} /> {s}</button>
                ))}
              </div>
              <div className="mt2-ai-form-row">
                <label className="mt2-field">
                  <span>Category</span>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt2-select">
                    <option value="MARKETING">Marketing</option>
                    <option value="UTILITY">Utility</option>
                  </select>
                </label>
                <label className="mt2-field">
                  <span>Language</span>
                  <select value={language} onChange={(e) => setLanguage(e.target.value)} className="mt2-select">
                    {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </label>
                <label className="mt2-field">
                  <span>Tone</span>
                  <select value={tone} onChange={(e) => setTone(e.target.value)} className="mt2-select">
                    <option value="professional">Professional</option>
                    <option value="friendly">Friendly</option>
                    <option value="casual">Casual</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </label>
              </div>
              {error && <div className="mt2-error-banner"><AlertTriangle size={16} /> {error}</div>}
              <button onClick={handleGenerate} disabled={generating || !goal.trim()} className="mt2-submit-btn" style={{ width: '100%', justifyContent: 'center' }}>
                {generating ? <><Loader2 size={14} className="crm-spin" /> Generating...</> : <><Sparkles size={14} /> Generate Template</>}
              </button>
            </>
          ) : (
            <>
              <div className="mt2-ai-result-preview">
                <div className="mt2-ai-result-header">
                  <CheckCircle2 size={20} style={{ color: '#16a34a' }} />
                  <span>Template generated! Review and apply it to the editor.</span>
                </div>
                <div className="mt2-ai-result-card">
                  {result.header && <div className="mt2-ai-result-section"><span className="mt2-ai-result-label">Header</span><p>{result.header}</p></div>}
                  <div className="mt2-ai-result-section"><span className="mt2-ai-result-label">Body</span><p className="mt2-ai-result-body">{result.body}</p></div>
                  {result.footer && <div className="mt2-ai-result-section"><span className="mt2-ai-result-label">Footer</span><p>{result.footer}</p></div>}
                  {result.bodyExamples?.length > 0 && <div className="mt2-ai-result-section"><span className="mt2-ai-result-label">Example Values</span><p>{result.bodyExamples.join(', ')}</p></div>}
                  {result.buttons?.length > 0 && (
                    <div className="mt2-ai-result-section"><span className="mt2-ai-result-label">Buttons</span>
                      <div className="mt2-ai-result-btns">{result.buttons.map((b: any, i: number) => <span key={i} className="mt2-ai-result-btn-pill">{b.text}</span>)}</div>
                    </div>
                  )}
                  <div className="mt2-ai-result-section"><span className="mt2-ai-result-label">Template Name</span><p className="mt2-ai-result-name">{result.name}</p></div>
                </div>
              </div>
              <div className="mt2-ai-result-actions">
                <button onClick={() => setResult(null)} className="mt2-cancel-btn">Try Again</button>
                <button onClick={handleApply} className="mt2-submit-btn"><CheckCircle2 size={14} /> Apply to Editor</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TemplateHeatmapModal({ template, onClose }: { template: WaTemplate; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dataPoints, setDataPoints] = useState<{ date: string; dayOfWeek: number; hour: number; sent: number; delivered: number; read: number; clicked: number }[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true); setError('');
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) return;
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-templates?action=heatmap&name=${encodeURIComponent(template.name)}`;
        const res = await fetch(apiUrl, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (!res.ok || data.error) { setError(data.error || 'Failed to load heatmap data'); return; }
        setDataPoints(data.dataPoints || []);
      } catch { setError('Failed to load heatmap data'); }
      finally { setLoading(false); }
    })();
  }, [template.name]);

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const HOURS = Array.from({ length: 24 }, (_, i) => i);

  const cellMap: Record<string, { sent: number; read: number; rate: number }> = {};
  let maxRate = 0;
  dataPoints.forEach((dp) => {
    const key = `${dp.dayOfWeek}-${dp.hour}`;
    const rate = dp.delivered > 0 ? (dp.read / dp.delivered) * 100 : 0;
    if (!cellMap[key] || cellMap[key].sent < dp.sent) {
      cellMap[key] = { sent: dp.sent, read: dp.read, rate };
      if (rate > maxRate) maxRate = rate;
    }
  });

  const getHeatColor = (rate: number) => {
    if (rate === 0) return 'rgba(148,163,184,0.08)';
    const intensity = Math.min(rate / Math.max(maxRate, 1), 1);
    const alpha = 0.15 + intensity * 0.85;
    return `rgba(22,163,74,${alpha})`;
  };

  const totalSent = dataPoints.reduce((s, d) => s + d.sent, 0);
  const totalRead = dataPoints.reduce((s, d) => s + d.read, 0);
  const overallRate = totalSent > 0 ? ((totalRead / totalSent) * 100).toFixed(1) : '0';

  return (
    <div className="mt2-modal-overlay" onClick={onClose}>
      <div className="mt2-modal-card mt2-modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="mt2-modal-header">
          <div className="mt2-modal-title"><Activity size={18} /><span>Performance Heatmap: {template.name}</span></div>
          <button onClick={onClose} className="mt2-modal-close"><X size={18} /></button>
        </div>
        <div className="mt2-modal-body">
          {loading ? (
            <div className="mt2-loading-state"><Loader2 size={24} className="crm-spin" style={{ color: '#25D366' }} /><p>Loading heatmap data (last 30 days)...</p></div>
          ) : error ? (
            <div className="mt2-error-banner"><AlertTriangle size={16} /> {error}</div>
          ) : dataPoints.length === 0 ? (
            <div className="mt2-empty-state" style={{ padding: 40 }}><Activity size={36} style={{ opacity: 0.25, marginBottom: 8 }} /><p>No analytics data available for this template yet.</p></div>
          ) : (
            <>
              <div className="mt2-heatmap-summary">
                <div className="mt2-heatmap-stat"><span className="mt2-heatmap-stat-num">{totalSent}</span><span className="mt2-heatmap-stat-label">Total Sent</span></div>
                <div className="mt2-heatmap-stat"><span className="mt2-heatmap-stat-num">{totalRead}</span><span className="mt2-heatmap-stat-label">Total Read</span></div>
                <div className="mt2-heatmap-stat"><span className="mt2-heatmap-stat-num">{overallRate}%</span><span className="mt2-heatmap-stat-label">Read Rate</span></div>
                <div className="mt2-heatmap-stat"><span className="mt2-heatmap-stat-num">{dataPoints.length}</span><span className="mt2-heatmap-stat-label">Data Days</span></div>
              </div>
              <p className="mt2-modal-desc">This heatmap shows read rates by day of week and hour. Darker green = higher read rate. Use this to pick the best time to send broadcasts using this template.</p>
              <div className="mt2-heatmap-wrap">
                <div className="mt2-heatmap-grid">
                  <div className="mt2-heatmap-corner" />
                  {HOURS.map((h) => (
                    <div key={h} className="mt2-heatmap-hour-label">{h % 6 === 0 ? `${h}:00` : ''}</div>
                  ))}
                  {DAYS.map((day, dIdx) => (
                    <Fragment key={day}>
                      <div className="mt2-heatmap-day-label">{day}</div>
                      {HOURS.map((h) => {
                        const cell = cellMap[`${dIdx}-${h}`];
                        const rate = cell?.rate || 0;
                        return (
                          <div key={`${dIdx}-${h}`} className="mt2-heatmap-cell" style={{ background: getHeatColor(rate) }} title={`${day} ${h}:00 — Sent: ${cell?.sent || 0}, Read: ${cell?.read || 0}, Rate: ${rate.toFixed(1)}%`}>
                            {cell && cell.sent > 0 && <span className="mt2-heatmap-cell-val">{Math.round(rate)}%</span>}
                          </div>
                        );
                      })}
                    </Fragment>
                  ))}
                </div>
                <div className="mt2-heatmap-legend">
                  <span>Low</span>
                  <div className="mt2-heatmap-legend-bar">
                    <div className="mt2-heatmap-legend-gradient" />
                  </div>
                  <span>High Read Rate</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MessageTemplates({ session, onBack, embedded }: { session: Session; onBack: () => void; embedded?: boolean }) {
  const [waTemplates, setWaTemplates] = useState<WaTemplate[]>([]);
  const [waTemplatesLoading, setWaTemplatesLoading] = useState(false);
  const [waTemplateError, setWaTemplateError] = useState('');
  const [showWaTemplateForm, setShowWaTemplateForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'APPROVED' | 'PENDING' | 'REJECTED'>('all');
  const [filterCategory, setFilterCategory] = useState<'all' | 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'>('all');
  const [tplMode, setTplMode] = useState<TemplateMode>('standard');
  const [tplName, setTplName] = useState('');
  const [tplLanguage, setTplLanguage] = useState('en_US');
  const [tplCategory, setTplCategory] = useState('MARKETING');
  const [tplBody, setTplBody] = useState('');
  const [tplFooter, setTplFooter] = useState('');
  const [tplCreating, setTplCreating] = useState(false);
  const [tplHeader, setTplHeader] = useState('');
  const [tplHeaderFormat, setTplHeaderFormat] = useState<HeaderFormat>('NONE');
  const [tplHeaderExample, setTplHeaderExample] = useState('');
  const [tplMediaUrl, setTplMediaUrl] = useState('');
  const [tplBodyExample, setTplBodyExample] = useState('');
  const [tplButtons, setTplButtons] = useState<TplButton[]>([]);
  const [tplEditingId, setTplEditingId] = useState<string | null>(null);
  const [tplSyncingId, setTplSyncingId] = useState<string | null>(null);
  const [tplTestingId, setTplTestingId] = useState<string | null>(null);
  const [testSendTpl, setTestSendTpl] = useState<WaTemplate | null>(null);
  const [translateTpl, setTranslateTpl] = useState<WaTemplate | null>(null);
  const [analyticsTpl, setAnalyticsTpl] = useState<WaTemplate | null>(null);
  const [carouselCards, setCarouselCards] = useState<CarouselCard[]>([]);
  const [authAddButtonType, setAuthAddButtonType] = useState<'COPY_CODE' | 'URL' | null>('COPY_CODE');
  const [authUrl, setAuthUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadedHandle, setUploadedHandle] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Number selector state — multi-select
  const [phoneNumbers, setPhoneNumbers] = useState<{ id: string; phone_number_id: string; connected_phone_number: string | null; label: string | null }[]>([]);
  const [selectedPhoneIds, setSelectedPhoneIds] = useState<Set<string>>(new Set());
  const selectedPhonesRef = useRef<Set<string>>(new Set());
  const [showPhoneDropdown, setShowPhoneDropdown] = useState(false);
  const phoneDropdownRef = useRef<HTMLDivElement>(null);

  // New feature state
  const [showLibrary, setShowLibrary] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState<WaTemplate | null>(null);
  const [showABTest, setShowABTest] = useState(false);
  const [showABTestList, setShowABTestList] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [tags, setTags] = useState<TemplateTag[]>([]);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [templateTags, setTemplateTags] = useState<Record<string, TemplateTag[]>>({});

  // Feature batch 2 state
  const [showImportExport, setShowImportExport] = useState(false);
  const [showUsage, setShowUsage] = useState(false);
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [showExpiry, setShowExpiry] = useState(false);
  const [showLangGroups, setShowLangGroups] = useState(false);
  const [showCompliance, setShowCompliance] = useState(false);
  const [varMappings, setVarMappings] = useState<Record<number, string>>({});
  const [showAiGenerator, setShowAiGenerator] = useState(false);
  const [heatmapTpl, setHeatmapTpl] = useState<WaTemplate | null>(null);

  // Approval notification state
  const [notifications, setNotifications] = useState<{ id: string; template_name: string; template_language: string; old_status: string; new_status: string; rejection_reason: string | null; phone_label: string | null; read: boolean; created_at: string }[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const fetchPhoneNumbers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_settings')
        .select('id, phone_number_id, connected_phone_number, label')
        .order('created_at', { ascending: true });
      if (error) return;
      setPhoneNumbers((data || []) as any[]);
      if (data && data.length > 0 && selectedPhonesRef.current.size === 0) {
        const firstId = data[0].phone_number_id;
        selectedPhonesRef.current = new Set([firstId]);
        setSelectedPhoneIds(new Set([firstId]));
      }
    } catch { /* ignore */ }
  }, []);

  const fetchWaTemplates = useCallback(async () => {
    setWaTemplatesLoading(true);
    setWaTemplateError('');
    setWaTemplates([]);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const ids = [...selectedPhonesRef.current];
      if (ids.length === 0) { setWaTemplatesLoading(false); return; }
      // Fetch templates from each selected WhatsApp number in parallel, then merge
      const results = await Promise.all(ids.map(async (pid) => {
        const qs = `&phone_number_id=${encodeURIComponent(pid)}`;
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-templates?action=list${qs}`;
        const res = await fetch(apiUrl, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (!res.ok || data.error) return [];
        const label = data.phone_label || pid;
        return (data.templates || []).map((t: any) => ({ ...t, phone_label: label }));
      }));
      // Deduplicate by meta_template_id (same WABA = same templates)
      const seen = new Set<string>();
      const merged: any[] = [];
      for (const batch of results) {
        for (const t of batch) {
          const key = t.meta_template_id || `${t.name}_${t.language}`;
          if (!seen.has(key)) { seen.add(key); merged.push(t); }
        }
      }
      setWaTemplates(merged);
    } catch { setWaTemplateError('Failed to load templates'); }
    finally { setWaTemplatesLoading(false); }
  }, []);

  const togglePhoneSelection = (id: string) => {
    const next = new Set(selectedPhonesRef.current);
    if (next.has(id)) { if (next.size > 1) next.delete(id); }
    else next.add(id);
    selectedPhonesRef.current = next;
    setSelectedPhoneIds(next);
    fetchWaTemplates();
  };

  // Close phone dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (phoneDropdownRef.current && !phoneDropdownRef.current.contains(e.target as Node)) setShowPhoneDropdown(false);
    };
    if (showPhoneDropdown) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPhoneDropdown]);

  useEffect(() => { fetchPhoneNumbers(); }, [fetchPhoneNumbers]);
  useEffect(() => { fetchWaTemplates(); }, [fetchWaTemplates]);

  // Fetch and poll template approval notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('wa_template_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) return;
      setNotifications((data || []) as any[]);
      setUnreadCount((data || []).filter((n: any) => !n.read).length);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);
  useEffect(() => {
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close notification panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifPanel(false);
    };
    if (showNotifPanel) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNotifPanel]);

  const markNotificationsRead = async () => {
    if (unreadCount === 0) return;
    setUnreadCount(0);
    await supabase.from('wa_template_notifications').update({ read: true }).eq('read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  // Fetch tags
  const fetchTags = useCallback(async () => {
    try {
      const { data: tagData, error } = await supabase.from('wa_template_tags').select('*').order('name');
      if (error) return;
      const { data: assignments } = await supabase.from('wa_template_tag_assignments').select('template_id, tag_id');
      const countMap: Record<string, number> = {};
      (assignments || []).forEach((a: { template_id: string; tag_id: string }) => { countMap[a.tag_id] = (countMap[a.tag_id] || 0) + 1; });
      setTags((tagData || []).map((t: any) => ({ id: t.id, name: t.name, color: t.color, count: countMap[t.id] || 0 })));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchTags(); }, [fetchTags]);

  const handleAddTag = async (name: string, color: string) => {
    const { error } = await supabase.from('wa_template_tags').insert({ name, color });
    if (error) throw error;
    await fetchTags();
  };

  const handleDeleteTag = async (id: string) => {
    await supabase.from('wa_template_tags').delete().eq('id', id);
    await fetchTags();
  };

  const handleArchiveToggle = async (tpl: WaTemplate) => {
    if (!tpl.meta_template_id) return;
    const { data: existing } = await supabase.from('wa_message_templates').select('id, archived').eq('meta_template_id', tpl.meta_template_id).maybeSingle();
    if (existing) {
      await supabase.from('wa_message_templates').update({ archived: !existing.archived, updated_at: new Date().toISOString() }).eq('id', existing.id);
    }
    await fetchWaTemplates();
  };

  const handleBulkSync = async () => {
    setBulkAction(true);
    for (const id of selectedTemplateIds) {
      await handleSyncWaTemplate(id);
    }
    setSelectedTemplateIds(new Set());
    setBulkAction(false);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedTemplateIds.size} templates from Meta? This cannot be undone.`)) return;
    setBulkAction(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      for (const id of selectedTemplateIds) {
        const tpl = waTemplates.find((t) => t.meta_template_id === id);
        if (!tpl) continue;
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-templates?action=delete`;
        await fetch(apiUrl, { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ meta_template_id: id, name: tpl.name }) });
      }
      setSelectedTemplateIds(new Set());
      await fetchWaTemplates();
    } catch { setWaTemplateError('Bulk delete failed'); }
    finally { setBulkAction(false); }
  };

  const handleBulkArchive = async () => {
    setBulkAction(true);
    for (const id of selectedTemplateIds) {
      const { data: existing } = await supabase.from('wa_message_templates').select('id').eq('meta_template_id', id).maybeSingle();
      if (existing) await supabase.from('wa_message_templates').update({ archived: true, updated_at: new Date().toISOString() }).eq('id', existing.id);
    }
    setSelectedTemplateIds(new Set());
    await fetchWaTemplates();
    setBulkAction(false);
  };

  const handleImportLibraryTemplate = (tpl: typeof PREBUILT_TEMPLATES[0]) => {
    setShowLibrary(false);
    resetTplForm();
    setTplMode('standard');
    setTplName(tpl.name);
    setTplCategory(tpl.category);
    if (tpl.category === 'AUTHENTICATION') setTplMode('authentication');
    setTplBody(tpl.body);
    if (tpl.header) { setTplHeaderFormat('TEXT'); setTplHeader(tpl.header); }
    if (tpl.footer) setTplFooter(tpl.footer);
    if (tpl.buttons) setTplButtons(tpl.buttons.map((b) => ({ type: b.type, text: b.text, url: b.url || '', phone: '' })));
    // Auto-generate example values
    const varCount = (tpl.body.match(/\{\{\d+\}\}/g) || []).length;
    if (varCount > 0) {
      const examples: string[] = [];
      for (let i = 0; i < varCount; i++) examples.push(`example${i + 1}`);
      setTplBodyExample(examples.join(', '));
    }
    setShowWaTemplateForm(true);
  };

  const handleImportJson = async (templates: any[]) => {
    for (const tpl of templates.slice(0, 20)) {
      resetTplForm();
      setTplMode('standard');
      setTplName(tpl.name || 'imported_template');
      setTplCategory(tpl.category || 'MARKETING');
      setTplLanguage(tpl.language || 'en_US');
      const bodyComp = tpl.components?.find((c: any) => c.type === 'BODY');
      const headerComp = tpl.components?.find((c: any) => c.type === 'HEADER');
      const footerComp = tpl.components?.find((c: any) => c.type === 'FOOTER');
      const buttonsComp = tpl.components?.find((c: any) => c.type === 'BUTTONS');
      if (bodyComp) setTplBody(bodyComp.text || '');
      if (headerComp?.format === 'TEXT') { setTplHeaderFormat('TEXT'); setTplHeader(headerComp.text || ''); }
      if (footerComp) setTplFooter(footerComp.text || '');
      if (buttonsComp?.buttons) setTplButtons(buttonsComp.buttons.map((b: any) => ({ type: b.type, text: b.text || '', url: b.url || '', phone: b.phone_number || '', flowId: b.flow_id || '', navigateScreen: b.navigate_screen || '' })));
      if (bodyComp?.example?.body_text) setTplBodyExample(bodyComp.example.body_text[0].join(', '));
      setShowWaTemplateForm(true);
      break; // Load first one into editor, rest can be done one at a time
    }
  };

  const handleSaveVersion = async (template: WaTemplate) => {
    if (!template.meta_template_id) return;
    const { data: existing } = await supabase.from('wa_message_templates').select('id').eq('meta_template_id', template.meta_template_id).maybeSingle();
    if (!existing) return;
    const { count } = await supabase.from('wa_template_versions').select('*', { count: 'exact', head: true }).eq('template_id', existing.id);
    await supabase.from('wa_template_versions').insert({
      template_id: existing.id,
      version_number: (count || 0) + 1,
      components: template.components,
      name: template.name,
      changed_by: 'Edit',
    });
  };

  const handleRestoreVersion = (components: any[]) => {
    if (!showVersionHistory) return;
    handleEditWaTemplate({ ...showVersionHistory, components });
    setShowVersionHistory(null);
  };

  const handleCreateABTest = async (test: { name: string; variant_a_template: string; variant_b_template: string; variant_a_language: string; variant_b_language: string; split_percentage: number }) => {
    const { error } = await supabase.from('wa_ab_tests').insert(test);
    if (error) throw new Error(error.message);
  };

  const toggleTemplateSelection = (id: string) => {
    setSelectedTemplateIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Auto-refresh pending templates every 30s
  useEffect(() => {
    if (!autoRefresh) return;
    const hasPending = waTemplates.some((t) => t.status === 'PENDING');
    if (!hasPending) return;
    const interval = setInterval(() => { fetchWaTemplates(); }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, waTemplates, fetchWaTemplates]);

  const resetTplForm = () => {
    setTplName(''); setTplBody(''); setTplFooter(''); setTplHeader('');
    setTplHeaderFormat('NONE'); setTplHeaderExample(''); setTplMediaUrl('');
    setTplBodyExample(''); setTplButtons([]); setTplCategory('MARKETING');
    setTplLanguage('en_US'); setTplEditingId(null); setTplMode('standard');
    setCarouselCards([]); setAuthAddButtonType('COPY_CODE'); setAuthUrl('');
    setUploadedHandle('');
  };

  const sanitizeTemplateName = (raw: string) =>
    raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

  const handleMediaUpload = async (file: File) => {
    setUploading(true); setWaTemplateError('');
    try {
      // Create a temporary URL for the file preview
      const tempUrl = URL.createObjectURL(file);
      setTplMediaUrl(tempUrl);
      // Upload to Meta via edge function
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', tplHeaderFormat.toLowerCase());
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-templates?action=media_upload`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || data.error) { setWaTemplateError(data.error || 'Upload failed'); return; }
      setUploadedHandle(data.handle || '');
    } catch { setWaTemplateError('Upload failed'); }
    finally { setUploading(false); }
  };

  const buildStandardComponents = () => {
    const components: any[] = [];
    if (tplHeaderFormat !== 'NONE') {
      if (tplHeaderFormat === 'TEXT') {
        const headerComp: any = { type: 'HEADER', format: 'TEXT', text: tplHeader.trim() };
        if (/\{\{1\}\}/.test(tplHeader) && tplHeaderExample.trim()) headerComp.example = { header_text: [tplHeaderExample.trim()] };
        components.push(headerComp);
      } else {
        const headerComp: any = { type: 'HEADER', format: tplHeaderFormat };
        if (uploadedHandle) headerComp.example = { header_handle: [uploadedHandle] };
        components.push(headerComp);
      }
    }
    const bodyComp: any = { type: 'BODY', text: tplBody.trim() };
    const varCount = (tplBody.match(/\{\{\d+\}\}/g) || []).length;
    if (varCount > 0 && tplBodyExample.trim()) {
      const examples = tplBodyExample.split(',').map((s) => s.trim()).filter(Boolean);
      if (examples.length > 0) bodyComp.example = { body_text: [examples] };
    }
    components.push(bodyComp);
    if (tplFooter.trim()) components.push({ type: 'FOOTER', text: tplFooter.trim() });
    if (tplButtons.length > 0) {
      components.push({
        type: 'BUTTONS',
        buttons: tplButtons.map((b) => {
          if (b.type === 'QUICK_REPLY') return { type: 'QUICK_REPLY', text: b.text };
          if (b.type === 'URL') return { type: 'URL', text: b.text, url: b.url || '' };
          if (b.type === 'FLOW') return { type: 'FLOW', text: b.text, flow_id: b.flowId || '', flow_action: 'navigate', navigate_screen: b.navigateScreen || undefined };
          if (b.type === 'OTP') return { type: 'OTP', otp_type: 'COPY_CODE' };
          return { type: 'PHONE_NUMBER', text: b.text, phone_number: b.phone || '' };
        }),
      });
    }
    return components;
  };

  const buildCarouselComponents = () => {
    const components: any[] = [];
    const validCards = carouselCards.filter((c) => c.mediaUrl.trim() && c.bodyText.trim());
    if (validCards.length === 0) return components;
    const headerComp: any = {
      type: 'HEADER',
      format: 'CAROUSEL',
      cards: validCards.map((c) => {
        const card: any = {
          format: c.mediaFormat,
          text: c.bodyText.trim(),
          buttons: c.buttons.length > 0 ? c.buttons.map((b) => {
            if (b.type === 'QUICK_REPLY') return { type: 'QUICK_REPLY', text: b.text };
            if (b.type === 'URL') return { type: 'URL', text: b.text, url: b.url || '' };
            if (b.type === 'FLOW') return { type: 'FLOW', text: b.text, flow_id: b.flowId || '', flow_action: 'navigate', navigate_screen: b.navigateScreen || undefined };
            return { type: 'PHONE_NUMBER', text: b.text, phone_number: b.phone || '' };
          }) : [{ type: 'QUICK_REPLY', text: 'Buy Now' }],
        };
        if (c.mediaUrl.trim()) card.example = { header_handle: [c.mediaUrl.trim()] };
        return card;
      }),
    };
    components.push(headerComp);
    return components;
  };

  const buildAuthComponents = () => {
    const components: any[] = [];
    const bodyText = tplBody.trim() || '{{1}} is your verification code.';
    const bodyComp: any = { type: 'BODY', text: bodyText };
    if (/\{\{1\}\}/.test(bodyText)) bodyComp.example = { body_text: ['123456'] };
    components.push(bodyComp);
    if (tplFooter.trim()) components.push({ type: 'FOOTER', text: tplFooter.trim() });
    const buttons: any[] = [{ type: 'COPY_CODE', text: 'Copy code' }];
    if (authAddButtonType === 'URL' && authUrl.trim()) {
      buttons.push({ type: 'URL', text: 'Visit Site', url: authUrl.trim() });
    }
    components.push({ type: 'BUTTONS', buttons });
    return components;
  };

  const validateTemplateForm = (): string | null => {
    const sanitizedName = sanitizeTemplateName(tplName);
    if (!sanitizedName) return 'Template name is required';
    if (sanitizedName.length < 5) return 'Template name must be at least 5 characters long';
    if (sanitizedName.length > 60) return 'Template name must be 60 characters or fewer';

    if (tplMode === 'carousel') {
      if (carouselCards.length < 2) return 'Carousel templates need at least 2 cards';
      for (let i = 0; i < carouselCards.length; i++) {
        const c = carouselCards[i];
        if (!c.mediaUrl.trim()) return `Card ${i + 1} is missing a media URL`;
        if (!c.bodyText.trim()) return `Card ${i + 1} is missing body text`;
      }
      return null;
    }

    if (tplMode === 'authentication') {
      if (!tplBody.trim() && tplBody !== '') return 'Body text is required';
      if (tplBody.length > 1024) return 'Body text must be 1024 characters or fewer';
      const bodyVars = (tplBody.match(/\{\{(\d+)\}\}/g) || []).map((m) => parseInt(m.match(/\d+/)![0], 10));
      if (bodyVars.length > 0 && [...new Set(bodyVars)].some((v) => v !== 1))
        return 'Authentication templates can only use {{1}} for the OTP code.';
      return null;
    }

    if (!tplBody.trim()) return 'Body text is required';
    if (tplBody.length > 1024) return 'Body text must be 1024 characters or fewer';
    if (tplHeaderFormat === 'TEXT' && !tplHeader.trim()) return 'Header format is Text but no header text was provided';
    if (tplHeaderFormat === 'TEXT' && tplHeader.length > 60) return 'Header text must be 60 characters or fewer';
    if ((tplHeaderFormat === 'IMAGE' || tplHeaderFormat === 'VIDEO' || tplHeaderFormat === 'DOCUMENT') && !tplMediaUrl.trim())
      return `Header format is ${tplHeaderFormat} but no media URL was provided`;
    const bodyVars = (tplBody.match(/\{\{(\d+)\}\}/g) || []).map((m) => parseInt(m.match(/\d+/)![0], 10));
    if (bodyVars.length > 0) {
      const uniqueVars = bodyVars.filter((value, index) => bodyVars.indexOf(value) === index).sort((a, b) => a - b);
      for (let i = 0; i < uniqueVars.length; i++) {
        if (uniqueVars[i] !== i + 1) return `Body variables must be sequential starting from {{1}}. Found {{${uniqueVars[i]}}} but expected {{${i + 1}}}.`;
      }
      if (!tplBodyExample.trim()) return 'Body has variables but no example values were provided. Meta requires example values for all variables.';
      const examples = tplBodyExample.split(',').map((s) => s.trim()).filter(Boolean);
      if (examples.length !== uniqueVars.length) return `Body has ${uniqueVars.length} variable(s) but ${examples.length} example value(s) were provided.`;
    }
    if (tplHeaderFormat === 'TEXT' && tplHeader.trim() && /\{\{1\}\}/.test(tplHeader) && !tplHeaderExample.trim())
      return 'Header has a variable but no example value was provided.';
    for (const [i, btn] of tplButtons.entries()) {
      if (!btn.text.trim()) return `Button ${i + 1} is missing a label`;
      if (btn.type === 'URL' && !btn.url?.trim()) return `Button ${i + 1} is missing a URL`;
      if (btn.type === 'PHONE_NUMBER' && !btn.phone?.trim()) return `Button ${i + 1} (Phone) is missing a phone number`;
      if (btn.type === 'FLOW' && !btn.flowId?.trim()) return `Button ${i + 1} (Flow) is missing a Flow ID`;
      if (btn.kind === 'COPY_CODE') return 'Copy offer code is only available for authentication templates.';
      if (btn.kind === 'WHATSAPP' && !btn.url?.startsWith('https://wa.me/')) return `Button ${i + 1} needs a WhatsApp link starting with https://wa.me/`;
    }
    return null;
  };

  const handleCreateWaTemplate = async () => {
    const validationError = validateTemplateForm();
    if (validationError) { setWaTemplateError(validationError); return; }
    setTplCreating(true); setWaTemplateError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      let components: any[];
      if (tplMode === 'carousel') components = buildCarouselComponents();
      else if (tplMode === 'authentication') {
        components = buildAuthComponents();
        setTplCategory('AUTHENTICATION');
      }
      else components = buildStandardComponents();
      const action = tplEditingId ? 'edit' : 'create';
      const sanitizedName = sanitizeTemplateName(tplName);
      const reqBody: any = { name: sanitizedName, language: tplLanguage, category: tplMode === 'authentication' ? 'AUTHENTICATION' : tplCategory, components };
      if (tplEditingId) reqBody.meta_template_id = tplEditingId;
      const selectedPhoneNumberId = [...selectedPhonesRef.current][0] || '';
      const pid = selectedPhoneNumberId ? `&phone_number_id=${encodeURIComponent(selectedPhoneNumberId)}` : '';
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-templates?action=${action}${pid}`;
      const res = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(reqBody) });
      const data = await res.json();
      if (!res.ok || data.error) { setWaTemplateError(data.error || 'Failed to save template'); return; }
      setShowWaTemplateForm(false); resetTplForm(); await fetchWaTemplates();
    } catch { setWaTemplateError('Failed to save template'); }
    finally { setTplCreating(false); }
  };

  const handleEditWaTemplate = (tpl: WaTemplate) => {
    resetTplForm();
    setTplEditingId(tpl.meta_template_id);
    setTplName(tpl.name);
    setTplLanguage(tpl.language);
    setTplCategory(tpl.category);
    const bodyComp = tpl.components?.find((c: any) => c.type === 'BODY');
    const headerComp = tpl.components?.find((c: any) => c.type === 'HEADER');
    const footerComp = tpl.components?.find((c: any) => c.type === 'FOOTER');
    const buttonsComp = tpl.components?.find((c: any) => c.type === 'BUTTONS');
    const carouselComp = tpl.components?.find((c: any) => c.type === 'HEADER' && c.format === 'CAROUSEL');
    if (carouselComp) {
      setTplMode('carousel');
      setCarouselCards((carouselComp.cards || []).map((c: any) => ({
        mediaFormat: c.format || 'IMAGE',
        mediaUrl: c.example?.header_handle?.[0] || '',
        bodyText: c.text || '',
        bodyExample: c.example?.body_text?.[0]?.[0] || '',
        buttons: (c.buttons || []).map((b: any) => ({ type: b.type, text: b.text || '', url: b.url || '', phone: b.phone_number || '' })),
      })));
    } else if (tpl.category === 'AUTHENTICATION') {
      setTplMode('authentication');
      setTplBody(bodyComp?.text || '');
      setTplFooter(footerComp?.text || '');
      const hasUrlBtn = buttonsComp?.buttons?.some((b: any) => b.type === 'URL');
      setAuthAddButtonType(hasUrlBtn ? 'URL' : 'COPY_CODE');
      setAuthUrl(buttonsComp?.buttons?.find((b: any) => b.type === 'URL')?.url || '');
    } else {
      setTplMode('standard');
      setTplBody(bodyComp?.text || '');
      setTplHeader(headerComp?.text || '');
      setTplHeaderFormat((headerComp?.format as HeaderFormat) || 'NONE');
      setTplFooter(footerComp?.text || '');
      setTplMediaUrl(headerComp?.example?.header_handle?.[0] || '');
      if (bodyComp?.example?.body_text) setTplBodyExample(bodyComp.example.body_text[0].join(', '));
      if (headerComp?.example?.header_text) setTplHeaderExample(headerComp.example.header_text[0]);
      if (buttonsComp?.buttons) setTplButtons(buttonsComp.buttons.map((b: any) => ({ type: b.type, text: b.text || '', url: b.url || '', phone: b.phone_number || '', flowId: b.flow_id || '', navigateScreen: b.navigate_screen || '' })));
    }
    setShowWaTemplateForm(true);
  };

  const handleSyncWaTemplate = async (metaTemplateId: string) => {
    setTplSyncingId(metaTemplateId); setWaTemplateError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-templates?action=sync&meta_template_id=${metaTemplateId}`;
      const res = await fetch(apiUrl, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok || data.error) { setWaTemplateError(data.error || 'Failed to sync template'); return; }
      await fetchWaTemplates();
    } catch { setWaTemplateError('Failed to sync template'); }
    finally { setTplSyncingId(null); }
  };

  const handleDeleteWaTemplate = async (tpl: WaTemplate) => {
    if (!confirm('Delete this template from Meta? This cannot be undone.')) return;
    setWaTemplateError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-templates?action=delete`;
      const res = await fetch(apiUrl, { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ meta_template_id: tpl.meta_template_id, name: tpl.name }) });
      const data = await res.json();
      if (!res.ok || data.error) { setWaTemplateError(data.error || 'Failed to delete template'); return; }
      setWaTemplates((prev) => prev.filter((t) => t.meta_template_id !== tpl.meta_template_id));
      await fetchWaTemplates();
    } catch { setWaTemplateError('Failed to delete template'); }
  };

  const handleClone = (tpl: WaTemplate) => {
    handleEditWaTemplate(tpl);
    setTplEditingId(null);
    setTplName(tpl.name + '_copy');
  };

  const handleTestSend = async (tpl: WaTemplate) => {
    setTplTestingId(tpl.meta_template_id);
    setTestSendTpl(tpl);
    setTplTestingId(null);
  };

  const insertVariable = () => {
    const existing = (tplBody.match(/\{\{(\d+)\}\}/g) || []).map((m) => parseInt(m.match(/\d+/)![0], 10));
    const nextNum = existing.length > 0 ? Math.max(...existing) + 1 : 1;
    setTplBody(tplBody + ` {{${nextNum}}}`);
  };

  const addTemplateButton = (kind: TplButtonKind) => {
    const defaults: Record<TplButtonKind, TplButton> = {
      CUSTOM: { type: 'QUICK_REPLY', kind, text: '' },
      WEBSITE: { type: 'URL', kind, text: 'Visit website', url: '' },
      WHATSAPP: { type: 'URL', kind, text: 'Call on WhatsApp', url: 'https://wa.me/' },
      PHONE: { type: 'PHONE_NUMBER', kind, text: 'Call Phone Number', phone: '' },
      FLOW: { type: 'FLOW', kind, text: 'Complete flow', flowId: '', navigateScreen: '' },
      COPY_CODE: { type: 'OTP', kind, text: 'Copy offer code' },
      SHARE_CONTACT: { type: 'QUICK_REPLY', kind, text: 'Share contact info' },
    };
    setTplButtons((prev) => prev.length < 10 ? [...prev, defaults[kind]] : prev);
  };

  const pendingCount = waTemplates.filter((t) => t.status === 'PENDING').length;
  const approvedCount = waTemplates.filter((t) => t.status === 'APPROVED').length;
  const rejectedCount = waTemplates.filter((t) => t.status === 'REJECTED').length;
  const filteredTemplates = waTemplates.filter((t) => {
    if (!showArchived && t.archived) return false;
    if (showArchived && !t.archived) return false;
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (filterCategory !== 'all' && t.category !== filterCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const bodyComp = t.components?.find((c: any) => c.type === 'BODY');
      if (!t.name.toLowerCase().includes(q) && !(bodyComp?.text || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });
  const approvedTemplates = waTemplates.filter((t) => t.status === 'APPROVED' && !t.archived);
  const bodyExampleArr = tplBodyExample.split(',').map((s) => s.trim()).filter(Boolean);
  const headerExampleArr = tplHeaderExample ? [tplHeaderExample] : [];
  const activeCategory = CATEGORIES.find((c) => c.value === tplCategory);
  const modeConfig: Record<TemplateMode, { label: string; icon: React.ReactNode; desc: string }> = {
    standard: { label: 'Standard', icon: <MessageSquare size={16} />, desc: 'Classic template with header, body, footer, and buttons' },
    carousel: { label: 'Carousel', icon: <ImageIcon size={16} />, desc: 'Swipeable cards, each with media and buttons (max 10 cards)' },
    authentication: { label: 'Authentication', icon: <KeyRound size={16} />, desc: 'OTP templates with Copy Code button for login verification' },
  };

  return (
    <div className="mt2-container">
      <div className="mt2-header">
        <div className="mt2-header-left">
          {!embedded && <button className="mt2-back-btn" onClick={onBack} aria-label="Back"><ArrowLeft size={18} /></button>}
          <div>
            <h1 className="mt2-title">WhatsApp Templates</h1>
            <p className="mt2-subtitle">Create and manage message templates approved by Meta</p>
          </div>
        </div>
        <div className="mt2-header-actions">
          <div ref={notifRef} style={{ position: 'relative' }}>
            <button className="mt2-refresh-btn" onClick={() => { setShowNotifPanel(!showNotifPanel); if (!showNotifPanel) markNotificationsRead(); }} title="Template approval notifications" style={{ position: 'relative' }}>
              <Bell size={16} /> Notifications
              {unreadCount > 0 && (
                <span style={{ position: 'absolute', top: -4, right: -4, background: '#dc2626', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 10, minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{unreadCount}</span>
              )}
            </button>
            {showNotifPanel && (
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, width: 380, maxHeight: 420, overflowY: 'auto', background: 'var(--mt2-card-bg, #1a1a2e)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.4)', zIndex: 1000, padding: 8 }}>
                <div style={{ padding: '8px 12px', fontSize: 13, fontWeight: 700, color: 'var(--mt2-text, #e4e4e7)', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 4 }}>Template Approval Updates</div>
                {notifications.length === 0 ? (
                  <div style={{ padding: '24px 12px', textAlign: 'center', color: '#71717a', fontSize: 13 }}>No notifications yet. You'll see template approval and rejection alerts here.</div>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} style={{ padding: '10px 12px', borderRadius: 8, marginBottom: 4, background: n.read ? 'transparent' : 'rgba(255,255,255,0.04)', cursor: 'default', transition: 'background 0.15s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        {n.new_status === 'APPROVED' ? <CheckCircle2 size={14} style={{ color: '#16a34a' }} /> : n.new_status === 'REJECTED' ? <XCircle size={14} style={{ color: '#dc2626' }} /> : <Clock size={14} style={{ color: '#d97706' }} />}
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--mt2-text, #e4e4e7)' }}>{n.template_name}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#a1a1aa', marginLeft: 22 }}>
                        {n.old_status && n.old_status !== n.new_status ? `${n.old_status} \u2192 ` : ''}{n.new_status}
                        {n.template_language && <span style={{ marginLeft: 6 }}>({n.template_language})</span>}
                        {n.phone_label && <span style={{ marginLeft: 6 }}>\u00b7 {n.phone_label}</span>}
                      </div>
                      {n.rejection_reason && <div style={{ fontSize: 11, color: '#dc2626', marginLeft: 22, marginTop: 4 }}>{n.rejection_reason}</div>}
                      <div style={{ fontSize: 10, color: '#71717a', marginLeft: 22, marginTop: 4 }}>{new Date(n.created_at).toLocaleString()}</div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          <button className="mt2-refresh-btn" onClick={fetchWaTemplates} disabled={waTemplatesLoading}>
            {waTemplatesLoading ? <Loader2 size={16} className="crm-spin" /> : <RefreshCw size={16} />} Refresh
          </button>
          {!showWaTemplateForm && <>
            <button className="mt2-refresh-btn" onClick={() => setShowLeaderboard(true)} title="Performance leaderboard"><TrendingUp size={16} /> Leaderboard</button>
            <button className="mt2-refresh-btn" onClick={() => setShowLibrary(true)} title="Template library"><Library size={16} /> Library</button>
            <button className="mt2-refresh-btn" onClick={() => setShowABTestList(true)} title="A/B tests"><FlaskConical size={16} /> A/B Tests</button>
            <button className="mt2-refresh-btn" onClick={() => setShowTagManager(true)} title="Manage tags"><Tags size={16} /> Tags</button>
            <button className="mt2-refresh-btn" onClick={() => setShowArchived(!showArchived)} title={showArchived ? 'Show active' : 'Show archived'}><Archive size={16} /> {showArchived ? 'Active' : 'Archived'}</button>
            <button className="mt2-refresh-btn" onClick={() => setShowImportExport(true)} title="Import/Export"><Download size={16} /> Backup</button>
            <button className="mt2-refresh-btn" onClick={() => setShowUsage(true)} title="Usage dashboard"><Activity size={16} /> Usage</button>
            <button className="mt2-refresh-btn" onClick={() => setShowAiGenerator(true)} title="AI template generator" style={{ color: '#7C3AED' }}><Sparkles size={16} /> AI Generate</button>
            <button className="mt2-refresh-btn" onClick={() => setShowLangGroups(true)} title="Language groups"><Globe size={16} /> Languages</button>
            <button className="mt2-new-btn" onClick={() => { if (tplEditingId) resetTplForm(); setShowWaTemplateForm(true); }}><Plus size={16} /> New Template</button>
          </>}
        </div>
      </div>

      {waTemplateError && <div className="mt2-error-banner"><AlertTriangle size={16} /> {waTemplateError}</div>}

      <div className="mt2-stats-grid">
        {[
          { icon: <FileTextIcon size={22} />, value: waTemplates.length, label: 'Total Templates', color: 'green' },
          { icon: <CheckCircle2 size={22} />, value: approvedCount, label: 'Approved', color: 'emerald' },
          { icon: <Clock size={22} />, value: pendingCount, label: 'Pending Review', color: 'amber' },
          { icon: <XCircle size={22} />, value: rejectedCount, label: 'Rejected', color: 'red' },
        ].map((card, i) => (
          <div key={i} className={`mt2-stat-card mt2-stat-${card.color}`}>
            <div className="mt2-stat-glow" />
            <div className="mt2-stat-top"><div className="mt2-stat-icon-wrap">{card.icon}</div></div>
            <span className="mt2-stat-value">{card.value}</span>
            <span className="mt2-stat-label">{card.label}</span>
          </div>
        ))}
      </div>

      {pendingCount > 0 && (
        <div className="mt2-autorefresh-banner">
          <Clock size={14} />
          <span>{pendingCount} template(s) pending review. Auto-refreshing every 30 seconds.</span>
          <label className="mt2-toggle"><input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} /><span className="mt2-toggle-slider" /></label>
        </div>
      )}

      {showWaTemplateForm && (
        <div className="mt2-form-layout">
          <div className="mt2-form-panel">
            <div className="mt2-form-panel-header">
              <div className="mt2-form-panel-title">
                {tplEditingId ? <Pencil size={18} /> : <Plus size={18} />}
                <h2>{tplEditingId ? 'Edit Template' : 'Create New Template'}</h2>
              </div>
              <button className="mt2-cancel-link" onClick={() => { setShowWaTemplateForm(false); resetTplForm(); }}><ArrowLeft size={14} /> Cancel</button>
            </div>
            <div className="mt2-form-body">
              {/* Template mode selector */}
              {!tplEditingId && (
                <div className="mt2-field mt2-field-full">
                  <span>Template Type</span>
                  <div className="mt2-mode-grid">
                    {(Object.keys(modeConfig) as TemplateMode[]).map((mode) => (
                      <button key={mode} type="button" className={`mt2-mode-btn ${tplMode === mode ? 'active' : ''}`} onClick={() => { setTplMode(mode); if (mode === 'authentication') setTplCategory('AUTHENTICATION'); }}>
                        {modeConfig[mode].icon}<span>{modeConfig[mode].label}</span>
                      </button>
                    ))}
                  </div>
                  <small className="mt2-field-hint">{modeConfig[tplMode].desc}</small>
                </div>
              )}

              <label className="mt2-field mt2-field-full">
                <span>Template Name <em>*</em></span>
                <input type="text" value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="order_confirmation" className="mt2-input mt2-input-mono" disabled={!!tplEditingId} />
                <small className="mt2-field-hint">Lowercase, numbers, underscores. No spaces. {tplEditingId ? '(Cannot change when editing)' : 'Min 5 chars.'}</small>
              </label>

              <label className="mt2-field">
                <span>Language <em>*</em></span>
                <select value={tplLanguage} onChange={(e) => setTplLanguage(e.target.value)} className="mt2-select" disabled={!!tplEditingId}>
                  {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </label>
              <label className="mt2-field">
                <span>Category <em>*</em></span>
                <select value={tplMode === 'authentication' ? 'AUTHENTICATION' : tplCategory} onChange={(e) => setTplCategory(e.target.value)} className="mt2-select" disabled={tplMode === 'authentication'}>
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </label>

              {activeCategory && tplMode !== 'authentication' && (
                <div className="mt2-category-info" style={{ borderColor: activeCategory.color + '40' }}>
                  <Info size={14} style={{ color: activeCategory.color, flexShrink: 0 }} />
                  <span style={{ color: activeCategory.color }}>{activeCategory.desc}</span>
                </div>
              )}

              {/* STANDARD MODE */}
              {tplMode === 'standard' && (
                <>
                  <div className="mt2-field mt2-field-full">
                    <span>Header Type</span>
                    <div className="mt2-header-format-grid">
                      {(Object.keys(headerFormatConfig) as HeaderFormat[]).map((fmt) => (
                        <button key={fmt} type="button" className={`mt2-header-format-btn ${tplHeaderFormat === fmt ? 'active' : ''}`} onClick={() => setTplHeaderFormat(fmt)}>
                          {headerFormatConfig[fmt].icon}<span>{headerFormatConfig[fmt].label}</span>
                        </button>
                      ))}
                    </div>
                    <small className="mt2-field-hint">{headerFormatConfig[tplHeaderFormat].desc}</small>
                  </div>

                  {tplHeaderFormat === 'TEXT' && (
                    <>
                      <label className="mt2-field mt2-field-full">
                        <span>Header Text</span>
                        <input type="text" value={tplHeader} onChange={(e) => setTplHeader(e.target.value)} placeholder="Order Confirmation" maxLength={60} className="mt2-input" />
                        <small className="mt2-field-hint">{tplHeader.length}/60 characters. Supports 1 variable: {'{{1}}'}.</small>
                      </label>
                      {tplHeader.trim() && /\{\{1\}\}/.test(tplHeader) && (
                        <label className="mt2-field mt2-field-full">
                          <span>Header Example Value</span>
                          <input type="text" value={tplHeaderExample} onChange={(e) => setTplHeaderExample(e.target.value)} placeholder="December 1st" className="mt2-input" />
                          <small className="mt2-field-hint mt2-field-hint-error">Required when header contains a variable.</small>
                        </label>
                      )}
                    </>
                  )}

                  {(tplHeaderFormat === 'IMAGE' || tplHeaderFormat === 'VIDEO' || tplHeaderFormat === 'DOCUMENT') && (
                    <div className="mt2-field mt2-field-full">
                      <span>{tplHeaderFormat} Upload <em>*</em></span>
                      <div className="mt2-upload-zone" onClick={() => fileInputRef.current?.click()}>
                        {uploading ? <Loader2 size={20} className="crm-spin" /> : <UploadCloud size={20} />}
                        <span>{tplMediaUrl ? 'File selected. Click to replace.' : 'Click to upload a file'}</span>
                        <input ref={fileInputRef} type="file" accept={tplHeaderFormat === 'IMAGE' ? 'image/jpeg,image/png' : tplHeaderFormat === 'VIDEO' ? 'video/mp4,video/3gpp' : 'application/pdf'} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleMediaUpload(f); }} style={{ display: 'none' }} />
                      </div>
                      {uploadedHandle && <small className="mt2-field-hint" style={{ color: '#16a34a' }}>Media uploaded to Meta. Handle: {uploadedHandle.slice(0, 20)}...</small>}
                      <input type="text" value={tplMediaUrl} onChange={(e) => { setTplMediaUrl(e.target.value); setUploadedHandle(''); }} placeholder="...or paste a URL directly" className="mt2-input" style={{ marginTop: 8 }} />
                    </div>
                  )}

                  <label className="mt2-field mt2-field-full">
                    <div className="mt2-field-label-row">
                      <span>Body Text <em>*</em></span>
                      <button type="button" className="mt2-insert-var-btn" onClick={insertVariable}><Sparkles size={11} /> Insert Variable</button>
                    </div>
                    <textarea value={tplBody} onChange={(e) => setTplBody(e.target.value)} rows={4} placeholder="Hi {{1}}, your order {{2}} has been confirmed." className="mt2-textarea" />
                    <div className="mt2-field-hint-row"><small className="mt2-field-hint">Use {'{{1}}'}, {'{{2}}'} etc. {tplBody.length}/1024 chars.</small></div>
                  </label>

                  {(tplBody.match(/\{\{\d+\}\}/g) || []).length > 0 && (
                    <label className="mt2-field mt2-field-full">
                      <span>Body Example Values</span>
                      <input type="text" value={tplBodyExample} onChange={(e) => setTplBodyExample(e.target.value)} placeholder="John, ORDER123" className="mt2-input" />
                      <small className="mt2-field-hint mt2-field-hint-error">Required when body has variables. Comma-separated.</small>
                    </label>
                  )}

                  <label className="mt2-field mt2-field-full">
                    <span>Footer (optional)</span>
                    <input type="text" value={tplFooter} onChange={(e) => setTplFooter(e.target.value)} placeholder="Reply STOP to unsubscribe" maxLength={60} className="mt2-input" />
                    <small className="mt2-field-hint">{tplFooter.length}/60 characters.</small>
                  </label>

                  {(tplBody.match(/\{\{\d+\}\}/g) || []).length > 0 && (
                    <VariableMapper body={tplBody} onMap={(varIdx, field) => setVarMappings((prev) => ({ ...prev, [varIdx]: field }))} />
                  )}

                  <ComplianceChecker body={tplBody} category={tplCategory} footer={tplFooter} header={tplHeader} />

                  <div className="mt2-buttons-section">
                    <div className="mt2-buttons-label">
                      <span>Buttons (optional, max 10)</span>
                      {tplButtons.length < 10 && (
                        <select
                          defaultValue=""
                          aria-label="Select button type"
                          className="mt2-btn-add-select"
                          onChange={(e) => {
                            if (e.target.value) addTemplateButton(e.target.value as TplButtonKind);
                            e.currentTarget.value = '';
                          }}
                        >
                          <option value="">Add Button</option>
                          <option value="CUSTOM">Custom</option>
                          <option value="WEBSITE">Visit website</option>
                          <option value="WHATSAPP">Call on WhatsApp</option>
                          <option value="PHONE">Call Phone Number</option>
                          <option value="FLOW">Complete flow</option>
                          <option value="COPY_CODE">Copy offer code</option>
                          <option value="SHARE_CONTACT">Share contact info</option>
                        </select>
                      )}
                    </div>
                    {tplButtons.map((btn, idx) => {
                      const buttonKind = btn.kind || (btn.type === 'URL' ? (btn.url?.startsWith('https://wa.me/') ? 'WHATSAPP' : 'WEBSITE') : btn.type === 'PHONE_NUMBER' ? 'PHONE' : btn.type === 'FLOW' ? 'FLOW' : btn.type === 'OTP' ? 'COPY_CODE' : 'CUSTOM');
                      return (
                        <div key={idx} className="mt2-button-row" style={{ flexWrap: 'wrap' }}>
                          <select value={buttonKind} onChange={(e) => {
                            const kind = e.target.value as TplButtonKind;
                            const defaults: Record<TplButtonKind, Partial<TplButton>> = {
                              CUSTOM: { type: 'QUICK_REPLY', kind, text: btn.text || 'Custom' },
                              WEBSITE: { type: 'URL', kind, text: btn.text || 'Visit website' },
                              WHATSAPP: { type: 'URL', kind, text: btn.text || 'Call on WhatsApp', url: btn.url || 'https://wa.me/' },
                              PHONE: { type: 'PHONE_NUMBER', kind, text: btn.text || 'Call Phone Number' },
                              FLOW: { type: 'FLOW', kind, text: btn.text || 'Complete flow' },
                              COPY_CODE: { type: 'OTP', kind, text: 'Copy offer code' },
                              SHARE_CONTACT: { type: 'QUICK_REPLY', kind, text: btn.text || 'Share contact info' },
                            };
                            const n = [...tplButtons]; n[idx] = { ...btn, ...defaults[kind] } as TplButton; setTplButtons(n);
                          }} className="mt2-btn-type-select">
                            <option value="CUSTOM">Custom</option>
                            <option value="WEBSITE">Visit website</option>
                            <option value="WHATSAPP">Call on WhatsApp</option>
                            <option value="PHONE">Call Phone Number</option>
                            <option value="FLOW">Complete flow</option>
                            <option value="COPY_CODE">Copy offer code</option>
                            <option value="SHARE_CONTACT">Share contact info</option>
                          </select>
                          <input type="text" value={btn.text} onChange={(e) => { const n = [...tplButtons]; n[idx] = { ...btn, text: e.target.value }; setTplButtons(n); }} placeholder="Button label" maxLength={25} className="mt2-btn-text-input" disabled={btn.type === 'OTP'} />
                          {btn.type === 'URL' && <input type="text" value={btn.url || ''} onChange={(e) => { const n = [...tplButtons]; n[idx] = { ...btn, url: e.target.value }; setTplButtons(n); }} placeholder={btn.kind === 'WHATSAPP' ? 'https://wa.me/919876543210' : 'https://...'} className="mt2-btn-text-input" />}
                          {btn.type === 'PHONE_NUMBER' && <input type="text" value={btn.phone || ''} onChange={(e) => { const n = [...tplButtons]; n[idx] = { ...btn, phone: e.target.value }; setTplButtons(n); }} placeholder="+1234567890" className="mt2-btn-text-input" />}
                          {btn.type === 'FLOW' && <>
                            <input type="text" value={btn.flowId || ''} onChange={(e) => { const n = [...tplButtons]; n[idx] = { ...btn, flowId: e.target.value }; setTplButtons(n); }} placeholder="Flow ID" className="mt2-btn-text-input" />
                            <input type="text" value={btn.navigateScreen || ''} onChange={(e) => { const n = [...tplButtons]; n[idx] = { ...btn, navigateScreen: e.target.value }; setTplButtons(n); }} placeholder="Starting screen (optional)" className="mt2-btn-text-input" />
                          </>}
                          <button type="button" onClick={() => setTplButtons(tplButtons.filter((_, i) => i !== idx))} className="mt2-btn-remove"><Trash2 size={12} /></button>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* CAROUSEL MODE */}
              {tplMode === 'carousel' && (
                <div className="mt2-carousel-builder">
                  {carouselCards.map((card, idx) => (
                    <div key={idx} className="mt2-carousel-card-editor">
                      <div className="mt2-carousel-card-header">
                        <span>Card {idx + 1}</span>
                        <button type="button" onClick={() => setCarouselCards(carouselCards.filter((_, i) => i !== idx))} className="mt2-btn-remove"><Trash2 size={12} /></button>
                      </div>
                      <select value={card.mediaFormat} onChange={(e) => { const n = [...carouselCards]; n[idx] = { ...card, mediaFormat: e.target.value as 'IMAGE' | 'VIDEO' }; setCarouselCards(n); }} className="mt2-select">
                        <option value="IMAGE">Image</option><option value="VIDEO">Video</option>
                      </select>
                      <input type="text" value={card.mediaUrl} onChange={(e) => { const n = [...carouselCards]; n[idx] = { ...card, mediaUrl: e.target.value }; setCarouselCards(n); }} placeholder="Image URL" className="mt2-input" />
                      <textarea value={card.bodyText} onChange={(e) => { const n = [...carouselCards]; n[idx] = { ...card, bodyText: e.target.value }; setCarouselCards(n); }} rows={2} placeholder="Card body text (max 160 chars)" maxLength={160} className="mt2-textarea" />
                      <div className="mt2-carousel-card-btns">
                        {card.buttons.map((btn, bidx) => (
                          <div key={bidx} className="mt2-button-row">
                            <input type="text" value={btn.text} onChange={(e) => { const nc = [...card.buttons]; nc[bidx] = { ...btn, text: e.target.value }; const n = [...carouselCards]; n[idx] = { ...card, buttons: nc }; setCarouselCards(n); }} placeholder="Button text" maxLength={25} className="mt2-btn-text-input" />
                            <button type="button" onClick={() => { const nc = card.buttons.filter((_, i) => i !== bidx); const n = [...carouselCards]; n[idx] = { ...card, buttons: nc }; setCarouselCards(n); }} className="mt2-btn-remove"><Trash2 size={12} /></button>
                          </div>
                        ))}
                        {card.buttons.length < 2 && <button type="button" onClick={() => { const n = [...carouselCards]; n[idx] = { ...card, buttons: [...card.buttons, { type: 'QUICK_REPLY', text: '' }] }; setCarouselCards(n); }} className="mt2-btn-add"><Plus size={12} /> Add Button</button>}
                      </div>
                    </div>
                  ))}
                  {carouselCards.length < 10 && <button type="button" onClick={() => setCarouselCards([...carouselCards, { mediaFormat: 'IMAGE', mediaUrl: '', bodyText: '', buttons: [] }])} className="mt2-carousel-add-card"><Plus size={16} /> Add Card ({carouselCards.length}/10)</button>}
                </div>
              )}

              {/* AUTHENTICATION MODE */}
              {tplMode === 'authentication' && (
                <>
                  <div className="mt2-auth-info">
                    <KeyRound size={16} />
                    <span>Authentication templates use a fixed format: a body with {'{{1}}'} for the OTP code, plus a "Copy code" button. An optional URL button can be added.</span>
                  </div>
                  <label className="mt2-field mt2-field-full">
                    <span>Body Text (optional)</span>
                    <textarea value={tplBody} onChange={(e) => setTplBody(e.target.value)} rows={2} placeholder="{{1}} is your verification code. For your security, do not share this code." className="mt2-textarea" />
                    <small className="mt2-field-hint">Use {'{{1}}'} for the OTP code. Leave blank to use the default: {'"{{1}} is your verification code."'}</small>
                  </label>
                  <label className="mt2-field mt2-field-full">
                    <span>Footer (optional)</span>
                    <input type="text" value={tplFooter} onChange={(e) => setTplFooter(e.target.value)} placeholder="Do not share this code" maxLength={60} className="mt2-input" />
                  </label>
                  <div className="mt2-field mt2-field-full">
                    <span>Add URL Button</span>
                    <div className="mt2-auth-btn-toggle">
                      <button type="button" className={authAddButtonType === null ? 'active' : ''} onClick={() => setAuthAddButtonType(null)}>No URL</button>
                      <button type="button" className={authAddButtonType === 'URL' ? 'active' : ''} onClick={() => setAuthAddButtonType('URL')}>Add URL Button</button>
                    </div>
                    {authAddButtonType === 'URL' && (
                      <input type="text" value={authUrl} onChange={(e) => setAuthUrl(e.target.value)} placeholder="https://yourapp.com/verify" className="mt2-input" style={{ marginTop: 8 }} />
                    )}
                  </div>
                </>
              )}

              <div className="mt2-form-actions">
                <button type="button" onClick={handleCreateWaTemplate} disabled={!tplName.trim() || tplCreating} className="mt2-submit-btn">
                  {tplCreating ? <Loader2 size={14} className="crm-spin" /> : <Send size={14} />}
                  {tplEditingId ? 'Update Template' : 'Submit for Review'}
                </button>
                <button type="button" onClick={() => { setShowWaTemplateForm(false); resetTplForm(); }} className="mt2-cancel-btn">Cancel</button>
              </div>
            </div>
          </div>

          {/* Live preview */}
          <div className="mt2-preview-panel">
            <div className="mt2-preview-panel-header"><Eye size={16} /><span>Live WhatsApp Preview</span></div>
            <div className="mt2-preview-phone-wrap">
              {tplMode === 'carousel' ? <CarouselPhonePreview cards={carouselCards} /> :
               tplMode === 'authentication' ? <AuthPhonePreview body={tplBody || '{{1}} is your verification code.'} addButtonType={authAddButtonType} /> :
               <WaPhonePreview headerFormat={tplHeaderFormat} headerText={tplHeader} headerExample={tplHeaderExample} body={tplBody} bodyExamples={bodyExampleArr} footer={tplFooter} buttons={tplButtons} mediaUrl={tplMediaUrl} />}
            </div>
            <div className="mt2-preview-tips"><Info size={13} /><span>This is how your template will appear in WhatsApp. Variables show example values when provided.</span></div>
          </div>
        </div>
      )}

      {!showWaTemplateForm && (
        <div className="mt2-list-card">
          <div className="mt2-filter-bar">
            <div className="mt2-search-wrap">
              <Search size={16} className="mt2-search-icon" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by name or body text..." className="mt2-search-input" />
            </div>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="mt2-filter-select">
              <option value="all">All Statuses</option><option value="APPROVED">Approved</option><option value="PENDING">Pending</option><option value="REJECTED">Rejected</option>
            </select>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value as any)} className="mt2-filter-select">
              <option value="all">All Categories</option><option value="MARKETING">Marketing</option><option value="UTILITY">Utility</option><option value="AUTHENTICATION">Authentication</option>
            </select>
            {phoneNumbers.length > 0 && (
              <div ref={phoneDropdownRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="mt2-filter-select"
                  style={{ minWidth: 180, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, cursor: 'pointer' }}
                  onClick={() => setShowPhoneDropdown(!showPhoneDropdown)}
                  title="Filter templates by WhatsApp number"
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedPhoneIds.size === phoneNumbers.length ? 'All Numbers' : selectedPhoneIds.size === 1 ? (phoneNumbers.find((p) => selectedPhoneIds.has(p.phone_number_id))?.label || phoneNumbers.find((p) => selectedPhoneIds.has(p.phone_number_id))?.connected_phone_number || '1 Number') : `${selectedPhoneIds.size} Numbers`}
                  </span>
                  <ChevronDown size={14} style={{ flexShrink: 0, opacity: 0.6 }} />
                </button>
                {showPhoneDropdown && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, width: 260, background: 'var(--mt2-card-bg, #1a1a2e)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 1000, padding: 4, maxHeight: 280, overflowY: 'auto' }}>
                    <div style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.5 }}>WhatsApp Numbers</div>
                    {phoneNumbers.map((p) => {
                      const isSelected = selectedPhoneIds.has(p.phone_number_id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => togglePhoneSelection(p.phone_number_id)}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6, border: 'none', background: isSelected ? 'rgba(37,211,102,0.1)' : 'transparent', color: 'var(--mt2-text, #e4e4e7)', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
                        >
                          {isSelected ? <CheckSquare size={15} style={{ color: '#25D366', flexShrink: 0 }} /> : <Square size={15} style={{ flexShrink: 0, opacity: 0.4 }} />}
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.label || p.connected_phone_number || p.phone_number_id}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {tags.length > 0 && (
              <select value={selectedTagFilter || ''} onChange={(e) => setSelectedTagFilter(e.target.value || null)} className="mt2-filter-select">
                <option value="">All Tags</option>
                {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
          </div>
          {selectedTemplateIds.size > 0 && (
            <div className="mt2-bulk-bar">
              <span>{selectedTemplateIds.size} selected</span>
              <button className="mt2-action-btn mt2-action-btn-ghost" onClick={handleBulkSync} disabled={bulkAction}>{bulkAction ? <Loader2 size={12} className="crm-spin" /> : <RefreshCw size={12} />} Sync All</button>
              <button className="mt2-action-btn mt2-action-btn-ghost" onClick={handleBulkArchive} disabled={bulkAction}><Archive size={12} /> Archive</button>
              <button className="mt2-action-btn mt2-action-btn-danger" onClick={handleBulkDelete} disabled={bulkAction}><Trash2 size={12} /> Delete All</button>
              <button className="mt2-action-btn mt2-action-btn-ghost" onClick={() => setSelectedTemplateIds(new Set())}>Clear</button>
            </div>
          )}
          <div className="mt2-list-header">
            <div className="mt2-list-title">
              <div className="mt2-list-icon"><FileTextIcon size={18} /></div>
              <h2>Templates</h2>
              <span className="mt2-list-count">{filteredTemplates.length}{filteredTemplates.length !== waTemplates.length ? ` of ${waTemplates.length}` : ''}</span>
            </div>
            <div className="mt2-list-header-actions">
              <button className="mt2-refresh-btn" onClick={() => setShowDuplicate(true)} title="Check for duplicates"><ClipboardCheck size={14} /> Duplicates</button>
              <button className="mt2-refresh-btn" onClick={() => setShowExpiry(true)} title="Expiry warnings"><CalendarClock size={14} /> Expiry</button>
            </div>
          </div>

          {waTemplatesLoading ? (
            <div className="mt2-loading-state"><Loader2 size={28} className="crm-spin" style={{ color: '#25D366' }} /><p>Loading templates...</p></div>
          ) : filteredTemplates.length === 0 ? (
            <div className="mt2-empty-state">
              <FileTextIcon size={40} style={{ opacity: 0.25, marginBottom: 10 }} />
              <h3>{waTemplates.length === 0 ? 'No templates yet' : 'No templates match your filters'}</h3>
              <p>{waTemplates.length === 0 ? 'Click "New Template" to create your first WhatsApp template.' : 'Try adjusting your search or filters.'}</p>
            </div>
          ) : (
            <div className="mt2-tpl-grid">
              {filteredTemplates.map((tpl) => (
                <TemplateCard key={tpl.meta_template_id || tpl.name} tpl={tpl} onEdit={handleEditWaTemplate} onDelete={handleDeleteWaTemplate} onSync={handleSyncWaTemplate} onClone={handleClone} onTestSend={handleTestSend} onAnalytics={(t) => setAnalyticsTpl(t)} onTranslate={(t) => setTranslateTpl(t)} onVersionHistory={(t) => setShowVersionHistory(t)} onArchive={handleArchiveToggle} onHeatmap={(t) => setHeatmapTpl(t)} selected={selectedTemplateIds.has(tpl.meta_template_id || '')} onSelect={toggleTemplateSelection} syncing={tplSyncingId === tpl.meta_template_id} testing={tplTestingId === tpl.meta_template_id} analyticsOpen={analyticsTpl?.meta_template_id === tpl.meta_template_id} />
              ))}
            </div>
          )}
        </div>
      )}

      {testSendTpl && <TestSendModal template={testSendTpl} phoneNumberId={[...selectedPhonesRef.current][0] || ''} onClose={() => setTestSendTpl(null)} />}
      {translateTpl && <TranslateModal template={translateTpl} onClose={() => { setTranslateTpl(null); fetchWaTemplates(); }} />}
      {analyticsTpl && <AnalyticsPanel template={analyticsTpl} onClose={() => setAnalyticsTpl(null)} />}
      {showLibrary && <TemplateLibraryModal onClose={() => setShowLibrary(false)} onImport={handleImportLibraryTemplate} />}
      {showLeaderboard && <LeaderboardPanel templates={waTemplates} onClose={() => setShowLeaderboard(false)} />}
      {showVersionHistory && <VersionHistoryModal template={showVersionHistory} onClose={() => setShowVersionHistory(null)} onRestore={handleRestoreVersion} />}
      {showABTest && <ABTestModal approvedTemplates={approvedTemplates} onClose={() => setShowABTest(false)} onSave={handleCreateABTest} />}
      {showABTestList && <ABTestListPanel onClose={() => setShowABTestList(false)} onRefresh={fetchWaTemplates} />}
      {showTagManager && <TagManagerModal onClose={() => setShowTagManager(false)} tags={tags} onAddTag={handleAddTag} onDeleteTag={handleDeleteTag} />}
      {showImportExport && <ImportExportModal templates={waTemplates} onClose={() => setShowImportExport(false)} onImport={handleImportJson} />}
      {showUsage && <UsageDashboard templates={waTemplates} onClose={() => setShowUsage(false)} />}
      {showDuplicate && <DuplicateDetectionModal templates={waTemplates} onClose={() => setShowDuplicate(false)} />}
      {showExpiry && <ExpiryWarningsPanel templates={waTemplates} onClose={() => setShowExpiry(false)} />}
      {showAiGenerator && <AiTemplateGeneratorModal onClose={() => setShowAiGenerator(false)} onApply={(tpl) => {
        setShowAiGenerator(false);
        resetTplForm();
        setTplMode('standard');
        setTplName(tpl.name);
        setTplBody(tpl.body);
        if (tpl.header) { setTplHeaderFormat('TEXT'); setTplHeader(tpl.header); }
        if (tpl.footer) setTplFooter(tpl.footer);
        if (tpl.bodyExamples.length > 0) setTplBodyExample(tpl.bodyExamples.join(', '));
        if (tpl.headerExample) setTplHeaderExample(tpl.headerExample);
        if (tpl.buttons.length > 0) setTplButtons(tpl.buttons.map((b) => ({ type: b.type, text: b.text, url: b.url || '', phone: '' })));
        setShowWaTemplateForm(true);
      }} />}
      {heatmapTpl && <TemplateHeatmapModal template={heatmapTpl} onClose={() => setHeatmapTpl(null)} />}
      {showLangGroups && <LanguageGroupView templates={waTemplates} onEdit={handleEditWaTemplate} onClose={() => setShowLangGroups(false)} />}
      {!showWaTemplateForm && approvedTemplates.length >= 2 && (
        <button className="mt2-abtest-fab" onClick={() => setShowABTest(true)} title="Create A/B Test"><FlaskConical size={20} /></button>
      )}
    </div>
  );
}
