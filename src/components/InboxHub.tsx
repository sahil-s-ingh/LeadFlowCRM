import { useState, useEffect, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { MessageCircle, Phone as PhoneIcon, Mail, Inbox as InboxIcon, Instagram } from 'lucide-react';

type InboxTab = 'telegram' | 'whatsapp' | 'instagram';

type InboxComponent = React.ComponentType<{
  session: Session;
  onUnreadChange: (n: number) => void;
  refreshKey: number;
  onRefresh: () => void;
  onCall?: (number: string) => void;
}>;

type InstagramComponent = React.ComponentType<{
  session: Session;
  onBack: () => void;
  onUnreadChange?: (n: number) => void;
  refreshKey?: number;
  onRefresh?: () => void;
}>;

interface InboxHubProps {
  session: Session;
  showTelegram: boolean;
  showWhatsApp: boolean;
  showInstagram?: boolean;
  ChatInbox: InboxComponent;
  WhatsAppInbox: InboxComponent;
  InstagramInbox?: InstagramComponent;
  onTotalUnreadChange?: (total: number) => void;
  onCall?: (number: string) => void;
  initialTab?: InboxTab;
}

export default function InboxHub({
  session,
  showTelegram,
  showWhatsApp,
  showInstagram,
  ChatInbox,
  WhatsAppInbox,
  InstagramInbox,
  onTotalUnreadChange,
  onCall,
  initialTab,
}: InboxHubProps) {
  const availableTabs: InboxTab[] = [];
  if (showTelegram) availableTabs.push('telegram');
  if (showWhatsApp) availableTabs.push('whatsapp');
  if (showInstagram && InstagramInbox) availableTabs.push('instagram');

  const [tab, setTab] = useState<InboxTab>(
    initialTab && availableTabs.includes(initialTab) ? initialTab : availableTabs[0] || 'telegram'
  );

  const [tgUnread, setTgUnread] = useState(0);
  const [waUnread, setWaUnread] = useState(0);
  const [igUnread, setIgUnread] = useState(0);
  const [tgRefresh, setTgRefresh] = useState(0);
  const [waRefresh, setWaRefresh] = useState(0);
  const [igRefresh, setIgRefresh] = useState(0);

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
      onTotalUnreadChange(tgUnread + waUnread + igUnread);
    }
  }, [tgUnread, waUnread, igUnread, onTotalUnreadChange]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
    }
  }, []);

  const TAB_META: Record<InboxTab, { label: string; icon: typeof Mail; color: string }> = {
    telegram: { label: 'Telegram', icon: MessageCircle, color: '#0088CC' },
    whatsapp: { label: 'WhatsApp', icon: PhoneIcon, color: '#25D366' },
    instagram: { label: 'Instagram', icon: Instagram, color: '#E1306C' },
  };

  const unreadFor = (t: InboxTab) =>
    t === 'telegram' ? tgUnread : t === 'whatsapp' ? waUnread : igUnread;

  return (
    <div>
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
              title={meta.label}
              style={active ? { borderBottomColor: meta.color, color: meta.color } : undefined}
            >
              <Icon size={20} />
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
        {mounted.has('instagram') && showInstagram && InstagramInbox && (
          <div style={{ display: tab === 'instagram' ? 'block' : 'none' }}>
            <InstagramInbox
              session={session}
              onBack={() => setTab(availableTabs[0] || 'telegram')}
              onUnreadChange={setIgUnread}
              refreshKey={igRefresh}
              onRefresh={() => setIgRefresh((k) => k + 1)}
            />
          </div>
        )}
        {availableTabs.length === 0 && (
          <div style={{ padding: '80px 20px', textAlign: 'center' }}>
            <InboxIcon size={40} style={{ opacity: 0.25, marginBottom: 12 }} />
            <p style={{ color: 'var(--text-dark)', fontSize: '0.9rem' }}>No inboxes available.</p>
          </div>
        )}
      </div>
    </div>
  );
}
