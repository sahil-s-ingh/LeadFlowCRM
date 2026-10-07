import { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  ArrowLeft, Link2, Copy, Check, MessageSquare, ExternalLink,
  Phone, ChevronDown,
  Eye, EyeOff, Zap, Loader2, Send, CheckCheck,
} from 'lucide-react';


export default function DirectLinkGenerator({ session, onBack }: { session: Session; onBack: () => void }) {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [revealNumber, setRevealNumber] = useState(false);
  const [shortUrl, setShortUrl] = useState('');
  const [shortening, setShorting] = useState(false);
  const [shortCopied, setShortCopied] = useState(false);
  const [shortError, setShortError] = useState('');

  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const encodedMessage = encodeURIComponent(message);
  const link = cleanPhone
    ? `https://wa.me/${cleanPhone}${encodedMessage ? `?text=${encodedMessage}` : ''}`
    : '';

  const maskedPhone = cleanPhone.length > 4
    ? '*'.repeat(cleanPhone.length - 4) + cleanPhone.slice(-4)
    : cleanPhone;
  const displayLink = cleanPhone
    ? `https://wa.me/${revealNumber ? cleanPhone : maskedPhone}${encodedMessage ? `?text=${encodedMessage}` : ''}`
    : '';

  const handleShorten = async () => {
    if (!link) return;
    setShorting(true);
    setShortError('');
    setShortUrl('');
    try {
      const token = session.access_token;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/short-link`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ originalUrl: link, phoneNumber: cleanPhone, message }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setShortError(data.error || 'Failed to shorten link');
        return;
      }
      setShortUrl(data.shortUrl);
    } catch {
      setShortError('Failed to shorten link');
    } finally {
      setShorting(false);
    }
  };

  const handleCopyShort = async () => {
    if (!shortUrl) return;
    try {
      await navigator.clipboard.writeText(shortUrl);
      setShortCopied(true);
      setTimeout(() => setShortCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = shortUrl;
      document.execCommand('copy');
      setShortCopied(true);
      setTimeout(() => setShortCopied(false), 2000);
    }
  };

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = link;
      document.execCommand('copy');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatTime = () => {
    const now = new Date();
    let h = now.getHours();
    const m = now.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  };

  return (
    <div className="dlg-container">
      {/* Hero Header */}
      <div className="dlg-hero">
        <div className="dlg-hero-pattern" />
        <button className="dlg-hero-back" onClick={onBack} aria-label="Back to dashboard">
          <ArrowLeft size={18} />
        </button>
        <div className="dlg-hero-content">
          <div className="dlg-hero-badge">
            <MessageSquare size={13} />
            <span>WhatsApp Link Tool</span>
          </div>
          <h1 className="dlg-hero-title">Direct Link Generator</h1>
          <p className="dlg-hero-desc">Create shareable WhatsApp chat links with pre-filled messages. Shorten, copy, and send in seconds.</p>
        </div>
        <div className="dlg-hero-stats">
          <div className="dlg-hero-stat">
            <span className="dlg-hero-stat-num">{message.length}</span>
            <span className="dlg-hero-stat-label">Characters</span>
          </div>
          <div className="dlg-hero-stat-divider" />
          <div className="dlg-hero-stat">
            <span className="dlg-hero-stat-num">{cleanPhone.length >= 8 ? 'Ready' : '—'}</span>
            <span className="dlg-hero-stat-label">Link Status</span>
          </div>
        </div>
      </div>

      <div className="dlg-body">
        {/* Left: Generator + Presets */}
        <div className="dlg-main-col">
          {/* Generator Card */}
          <div className="dlg-card dlg-generator-card">
            <div className="dlg-card-header">
              <div className="dlg-card-icon dlg-card-icon-green">
                <Link2 size={18} />
              </div>
              <div>
                <h2 className="dlg-card-title">Link Configuration</h2>
                <p className="dlg-card-subtitle">Enter a phone number and message to generate your link</p>
              </div>
            </div>

            <div className="dlg-card-body">
              {/* Phone Input */}
              <div className="dlg-field">
                <label className="dlg-field-label">
                  <Phone size={13} />
                  Phone Number
                </label>
                <div className="dlg-phone-field">
                  <span className="dlg-phone-prefix">+</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="919876543210"
                    className="dlg-input dlg-phone-input"
                    maxLength={15}
                  />
                  {cleanPhone && (
                    <span className={`dlg-phone-valid ${cleanPhone.length >= 8 ? 'ok' : ''}`}>
                      {cleanPhone.length >= 8 ? <Check size={13} /> : `${cleanPhone.length}/8`}
                    </span>
                  )}
                </div>
                <span className="dlg-field-hint">Country code + number, no spaces or symbols</span>
              </div>

              {/* Message Input */}
              <div className="dlg-field">
                <label className="dlg-field-label">
                  <MessageSquare size={13} />
                  Pre-filled Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type a message that will auto-fill when the link is opened..."
                  rows={4}
                  className="dlg-textarea"
                />
                <div className="dlg-msg-meta">
                  <span>{message.length} characters</span>
                </div>
              </div>

              {/* Generated Link */}
              {link ? (
                <div className="dlg-link-output">
                  <div className="dlg-link-display">
                    <div className="dlg-link-url">
                      <Link2 size={14} style={{ flexShrink: 0, color: '#128c7e' }} />
                      <span>{displayLink}</span>
                    </div>
                  </div>
                  <div className="dlg-link-toolbar">
                    <button className={`dlg-btn dlg-btn-primary ${copied ? 'dlg-btn-success' : ''}`} onClick={handleCopy}>
                      {copied ? <Check size={15} /> : <Copy size={15} />}
                      {copied ? 'Copied!' : 'Copy Link'}
                    </button>
                    <a href={link} target="_blank" rel="noopener noreferrer" className="dlg-btn dlg-btn-ghost">
                      <ExternalLink size={15} /> Open
                    </a>
                    <button className="dlg-btn dlg-btn-ghost dlg-btn-sm" onClick={() => setRevealNumber(!revealNumber)} title={revealNumber ? 'Hide number' : 'Reveal number'}>
                      {revealNumber ? <EyeOff size={15} /> : <Eye size={15} />}
                      {revealNumber ? 'Hide' : 'Reveal'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="dlg-link-empty">
                  <div className="dlg-link-empty-icon">
                    <Link2 size={24} />
                  </div>
                  <p>Enter a phone number above to generate your link</p>
                </div>
              )}

              {/* Short Link */}
              {link && (
                <div className="dlg-short-section">
                  <div className="dlg-short-header">
                    <Zap size={14} style={{ color: '#f59e0b' }} />
                    <span>Short Link</span>
                  </div>
                  {!shortUrl && !shortError && (
                    <button className="dlg-shorten-btn" onClick={handleShorten} disabled={shortening}>
                      {shortening ? <Loader2 size={15} className="crm-spin" /> : <Zap size={15} />}
                      {shortening ? 'Shortening...' : 'Generate Short Link'}
                    </button>
                  )}
                  {shortError && (
                    <div className="dlg-short-error">
                      <span>{shortError}</span>
                      <button className="dlg-short-retry" onClick={() => { setShortError(''); handleShorten(); }}>Try again</button>
                    </div>
                  )}
                  {shortUrl && (
                    <div className="dlg-short-result">
                      <div className="dlg-short-url">
                        <Zap size={13} style={{ flexShrink: 0, color: '#f59e0b' }} />
                        <span>{shortUrl}</span>
                      </div>
                      <div className="dlg-link-toolbar">
                        <button className={`dlg-btn dlg-btn-amber ${shortCopied ? 'dlg-btn-success' : ''}`} onClick={handleCopyShort}>
                          {shortCopied ? <Check size={14} /> : <Copy size={14} />}
                          {shortCopied ? 'Copied!' : 'Copy'}
                        </button>
                        <a href={shortUrl} target="_blank" rel="noopener noreferrer" className="dlg-btn dlg-btn-ghost dlg-btn-sm">
                          <ExternalLink size={14} /> Test
                        </a>
                        <button className="dlg-btn dlg-btn-ghost dlg-btn-sm" onClick={() => { setShortUrl(''); setShortError(''); }}>
                          <Trash2 size={14} /> Clear
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>


        </div>

        {/* Right: Phone Preview */}
        <div className="dlg-preview-col">
          <div className="dlg-phone-wrapper">
            <div className="dlg-phone-frame">
              <div className="dlg-phone-notch" />
              <div className="dlg-phone-screen">
                {/* WhatsApp Chat Header */}
                <div className="dlg-wa-header">
                  <div className="dlg-wa-header-back">
                    <ChevronDown size={18} />
                  </div>
                  <div className="dlg-wa-header-avatar">
                    <MessageSquare size={16} />
                  </div>
                  <div className="dlg-wa-header-info">
                    <span className="dlg-wa-header-name">{cleanPhone ? `+${revealNumber ? cleanPhone : maskedPhone}` : 'Business'}</span>
                    <span className="dlg-wa-header-status">online</span>
                  </div>
                  <div className="dlg-wa-header-icons">
                    <Phone size={16} />
                  </div>
                </div>

                {/* WhatsApp Chat Body */}
                <div className="dlg-wa-chat-bg">
                  <div className="dlg-wa-chat-body">
                    {message ? (
                      <div className="dlg-wa-bubble-out">
                        <div className="dlg-wa-bubble-tail" />
                        <p className="dlg-wa-bubble-text">{message}</p>
                        <span className="dlg-wa-bubble-time">
                          {formatTime()}
                          <CheckCheck size={13} style={{ marginLeft: 4, color: '#53bdeb' }} />
                        </span>
                      </div>
                    ) : (
                      <div className="dlg-wa-empty-chat">
                        <MessageSquare size={32} style={{ opacity: 0.2 }} />
                        <p>Type a message to see the preview</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* WhatsApp Input Bar */}
                <div className="dlg-wa-input-bar">
                  <div className="dlg-wa-input-field">
                    <span className="dlg-wa-input-placeholder">Message</span>
                  </div>
                  <div className="dlg-wa-send-btn">
                    <Send size={16} />
                  </div>
                </div>
              </div>
            </div>
            <div className="dlg-phone-caption">
              <Eye size={12} />
              <span>Live preview of how the message will appear</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
