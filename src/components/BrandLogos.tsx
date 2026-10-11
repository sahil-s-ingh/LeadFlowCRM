import React from 'react';

type IconProps = { size?: number; className?: string };

export const MetaLogo: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 44 44" fill="none" className={className} aria-label="Meta Ads">
    <path
      d="M5.5 21.1c0-6.2 3.7-10.5 8.2-10.5 3.8 0 6.2 2.3 8.3 7.5l2.5 6.1c1.6 3.9 3.2 6 5.7 6 2.2 0 3.7-1.6 3.7-4.3 0-2.5-1.2-4.8-3.5-7.4l1.6-2.2c2.8 3.1 4.3 6.2 4.3 9.8 0 5-3.3 8.5-7.4 8.5-3.5 0-5.8-2-7.7-6.2l-2.4-5.7c-1.5-3.6-2.9-5.2-4.8-5.2-2.2 0-3.6 1.8-3.6 4.8 0 3.4 1.7 6.1 5 9.2l-1.5 2.1C8.8 30.8 5.5 26.2 5.5 21.1z"
      fill="#0081FB"
    />
    <path
      d="M1.5 21.1c0-6.2 3.7-10.5 8.2-10.5 3.8 0 6.2 2.3 8.3 7.5l2.5 6.1c1.6 3.9 3.2 6 5.7 6 2.2 0 3.7-1.6 3.7-4.3 0-2.5-1.2-4.8-3.5-7.4l1.6-2.2c2.8 3.1 4.3 6.2 4.3 9.8 0 5-3.3 8.5-7.4 8.5-3.5 0-5.8-2-7.7-6.2l-2.4-5.7c-1.5-3.6-2.9-5.2-4.8-5.2-2.2 0-3.6 1.8-3.6 4.8 0 1.8.5 3.4 1.4 4.9l-1.4 1.9C2.4 27.6 1.5 24.5 1.5 21.1z"
      fill="#0064E1"
    />
  </svg>
);

export const GoogleAdsLogo: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-label="Google Ads">
    <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.1c4.15-3.83 6.57-9.47 6.57-16.17z" />
    <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.1-5.52c-1.97 1.32-4.49 2.1-7.46 2.1-5.74 0-10.61-3.88-12.35-9.11H4.35v5.69C7.97 41.07 15.4 46 24 46z" />
    <path fill="#FBBC05" d="M11.65 28.14c-.44-1.32-.69-2.73-.69-4.14s.25-2.82.69-4.14v-5.69H4.35C2.85 17.09 2 20.45 2 24s.85 6.91 2.35 9.83l7.3-5.69z" />
    <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.97 6.93 4.35 14.17l7.3 5.69c1.74-5.23 6.61-9.11 12.35-9.11z" />
  </svg>
);

export const YouTubeLogo: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-label="YouTube Ads">
    <rect x="2" y="5.5" width="20" height="13" rx="4" fill="#FF0000" />
    <path d="M10 9.5L15.5 12 10 14.5z" fill="#fff" />
  </svg>
);

export const TelegramLogo: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-label="Telegram Channel">
    <circle cx="12" cy="12" r="10" fill="#229ED9" />
    <path
      d="M16.94 7.8l-1.68 7.92c-.13.58-.47.72-.95.45l-2.62-1.93-1.26 1.22c-.14.14-.26.26-.53.26l.19-2.66 4.86-4.39c.21-.19-.05-.3-.33-.11L8.05 13.2l-2.6-.81c-.56-.18-.58-.56.12-.83l10.15-3.91c.47-.17.88.11.73.79z"
      fill="#fff"
    />
  </svg>
);

export const WhatsAppLogo: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-label="WhatsApp Group">
    <circle cx="12" cy="12" r="10" fill="#25D366" />
    <path
      d="M12 6.5c-3.04 0-5.5 2.46-5.5 5.5 0 1.08.31 2.09.85 2.93L6.5 17.5l2.65-.83c.81.44 1.74.69 2.85.69 3.04 0 5.5-2.46 5.5-5.5S15.04 6.5 12 6.5zm0 .92c2.53 0 4.58 2.05 4.58 4.58s-2.05 4.58-4.58 4.58c-.93 0-1.8-.28-2.52-.76l-.18-.12-1.4.44.44-1.36-.12-.19c-.5-.74-.8-1.62-.8-2.59 0-2.53 2.05-4.58 4.58-4.58zm2.47 3.15c-.06-.15-.27-.23-.42-.23s-.3.01-.46.07c-.14.06-.32.22-.32.43 0 .21.12.36.24.51.12.15.26.32.45.51.19.19.4.36.65.48.25.12.48.18.68.15.2-.03.4-.16.5-.31.08-.13.1-.27.08-.4-.01-.07-.06-.11-.14-.15l-.42-.2c-.07-.04-.13-.04-.18.03l-.15.19c-.04.05-.08.06-.15.03-.2-.08-.38-.18-.54-.34-.16-.16-.28-.34-.37-.55-.03-.06-.01-.1.03-.14l.12-.15c.04-.05.04-.09.02-.14l-.12-.42z"
      fill="#fff"
    />
  </svg>
);

export const SourceLogo: React.FC<IconProps & { source: string }> = ({ source, size = 16, className }) => {
  const s = source || 'Landing Page';
  switch (s) {
    case 'Meta Ads': return <MetaLogo size={size} className={className} />;
    case 'Google Ads': return <GoogleAdsLogo size={size} className={className} />;
    case 'YouTube Ads': return <YouTubeLogo size={size} className={className} />;
    case 'Telegram Channel': return <TelegramLogo size={size} className={className} />;
    case 'WhatsApp Group': return <WhatsAppLogo size={size} className={className} />;
    default: return null;
  }
};

export const SOURCE_META: Record<string, { label: string; color: string; bgColor: string }> = {
  'Meta Ads':           { label: 'Meta Ads',           color: '#0866FF', bgColor: 'rgba(8,102,255,0.1)' },
  'Google Ads':         { label: 'Google Ads',         color: '#4285F4', bgColor: 'rgba(66,133,244,0.1)' },
  'YouTube Ads':        { label: 'YouTube Ads',        color: '#FF0000', bgColor: 'rgba(255,0,0,0.08)' },
  'Telegram Channel':   { label: 'Telegram Channel',   color: '#229ED9', bgColor: 'rgba(34,158,217,0.1)' },
  'WhatsApp Group':     { label: 'WhatsApp Group',     color: '#25D366', bgColor: 'rgba(37,211,102,0.1)' },
  'Landing Page':       { label: 'Landing Page',       color: '#3B82F6', bgColor: 'rgba(59,130,246,0.1)' },
  'Direct Link':        { label: 'Direct Link',        color: '#06B6D4', bgColor: 'rgba(6,182,212,0.1)' },
  'Popup Form':         { label: 'Popup Form',         color: '#F59E0B', bgColor: 'rgba(245,158,11,0.1)' },
  'Bulk Upload':        { label: 'Bulk Upload',        color: 'var(--text-dark)', bgColor: 'rgba(100,116,139,0.1)' },
  'Manual Entry':       { label: 'Manual Entry',       color: '#EC4899', bgColor: 'rgba(236,72,153,0.1)' },
  'Webhook':            { label: 'Webhook',            color: '#EF4444', bgColor: 'rgba(239,68,68,0.1)' },
  'Unknown':            { label: 'Unknown',            color: 'var(--text-dark)', bgColor: 'rgba(148,163,184,0.1)' },
};

export const SOURCE_ORDER = [
  'Meta Ads', 'Google Ads', 'YouTube Ads', 'Telegram Channel', 'WhatsApp Group',
  'Landing Page', 'Direct Link', 'Popup Form', 'Bulk Upload', 'Manual Entry', 'Webhook',
];
