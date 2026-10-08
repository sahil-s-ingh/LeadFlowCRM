import { useState, useEffect, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { MessageCircle, Phone as PhoneIcon, Mail, Inbox as InboxIcon } from 'lucide-react';

type InboxTab = 'telegram' | 'whatsapp' | 'email';

interface InboxHubProps {
  session: Session;
  showTelegram: boolean;
  showWhatsApp: boolean;
  showEmail: boolean;
  ChatInbox: React.ComponentType<{ session: Session; onUnreadChange: (n: number) => void; refreshKey: number; onRefresh: () => void; onCall?: (number: string) => void }>;
  WhatsAppInbox: React.ComponentType<{ session: Session; onUnreadChange: (n: number) => void; refreshKey: number; onRefresh: () => void; onCall?: (number: string) => void }>;
  EmailInbox: React.ComponentType<{ session: Session; onUnreadChange: (n: number) => void; refreshKey: number; onRefresh: () => void }>;
  onTotalUnreadChange?: (total: number) => void;
  onCall?: (number: string) => void;
  initialTab?: InboxTab;
}

export default function InboxHub({
  session,
  showTelegram,
  showWhatsApp,
  showEmail,
  ChatInbox,
  WhatsAppInbox,
  EmailInbox,
  onTotalUnreadChange,
  onCall,
  initialTab,
}: InboxHubProps) {
  const availableTabs: InboxTab[] = [];
  if (showTelegram) availableTabs.push('telegram');
  if (showWhatsApp) availableTabs.push('whatsapp');
  if (showEmail) availableTabs.push('email');

  const [tab, setTab] = useState<InboxTab>(
    initialTab && availableTabs.includes(initialTab) ? initialTab : availableTabs[0] || 'email'
  );

  // Per-tab unread counts + refresh keys
  const [tgUnread, setTgUnread] = useState(0);
  const [waUnread, setWaUnread] = useState(0);
  const [emailUnread, setEmailUnread] = useState(0);
  const [tgRefresh, setTgRefresh] = useState(0);
  const [waRefresh, setWaRefresh] = useState(0);
  const [emailRefresh, setEmailRefresh] = useState(0);

  // Keep track of which tabs have been mounted so we don't unmount/remount
  // (preserves chat state when switching back)
  const [mounted, setMounted] = useState<Set<InboxTab>>(new Set([tab]));
  const firstRender = useRef(true);

  useEffect(() => {
    setMounted((prev) => {
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
  }, [tab]);

  useEffect(() => {
    if (onTotalUnreadChange) {
      onTotalUnreadChange(tgUnread + waUnread + emailUnread);
    }
  }, [tgUnread, waUnread, emailUnread, onTotalUnreadChange]);

  // Suppress the initial total-unread callback so we don't double-count
  // on first render (parent already has its own counters).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
    }
  }, []);

  const TAB_META: Record<InboxTab, { label: string; icon: typeof Mail; color: string }> = {
    telegram: { label: 'Telegram', icon: MessageCircle, color: '#0088CC' },
    whatsapp: { label: 'WhatsApp', icon: PhoneIcon, color: '#25D366' },
    email: { label: 'Email', icon: Mail, color: '#2563EB' },
  };

  const unreadFor = (t: InboxTab) =>
    t === 'telegram' ? tgUnread : t === 'whatsapp' ? waUnread : emailUnread;

  return (
    <div>
      {/* Tab bar */}
      <div className="ah-tabbar">
        {availableTabs.map((t) => {
          const meta = TAB_META[t];
          const active = tab === t;
          const count = unreadFor(t);
          const Icon = meta.icon;
          return (
            <button
              key={t}
              className={`ah-tab ${active ? 'ah-tab-active' : ''}`}
              onClick={() => setTab(t)}
              style={active ? { borderBottomColor: meta.color, color: meta.color } : undefined}
            >
              <Icon size={17} />
              <span>{meta.label}</span>
              {count > 0 && (
                <span
                  className="ah-tab-badge"
                  style={{ background: `${meta.color}22`, color: meta.color }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content — keep mounted tabs alive to preserve scroll/state */}
      <div className="ah-content">
        {mounted.has('telegram') && showTelegram && (
          <div style={{ display: tab === 'telegram' ? 'block' : 'none' }}>
            <ChatInbox
              session={session}
              onUnreadChange={setTgUnread}
              refreshKey={tgRefresh}
              onRefresh={() => setTgRefresh((k) => k + 1)}
              onCall={onCall}
            />
          </div>
        )}
        {mounted.has('whatsapp') && showWhatsApp && (
          <div style={{ display: tab === 'whatsapp' ? 'block' : 'none' }}>
            <WhatsAppInbox
              session={session}
              onUnreadChange={setWaUnread}
              refreshKey={waRefresh}
              onRefresh={() => setWaRefresh((k) => k + 1)}
              onCall={onCall}
            />
          </div>
        )}
        {mounted.has('email') && showEmail && (
          <div style={{ display: tab === 'email' ? 'block' : 'none' }}>
            <EmailInbox
              session={session}
              onUnreadChange={setEmailUnread}
              refreshKey={emailRefresh}
              onRefresh={() => setEmailRefresh((k) => k + 1)}
            />
          </div>
        )}
        {availableTabs.length === 0 && (
          <div style={{ padding: '80px 20px', textAlign: 'center' }}>
            <InboxIcon size={40} style={{ opacity: 0.25, marginBottom: 12 }} />
            <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No inboxes available.</p>
          </div>
        )}
      </div>
    </div>
  );
}
