import { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Send, Mail, MessageCircle } from 'lucide-react';
import WhatsAppBroadcast from '@/components/WhatsAppBroadcast';
import EmailBroadcast from '@/components/EmailBroadcast';
import TelegramBroadcast from '@/components/TelegramBroadcast';

type BroadcastTab = 'whatsapp' | 'email' | 'telegram';

interface BroadcastHubProps {
  session: Session;
  onBack: () => void;
  initialTab?: BroadcastTab;
}

const TABS: { key: BroadcastTab; label: string; icon: typeof Send; color: string }[] = [
  { key: 'whatsapp', label: 'WhatsApp Broadcast', icon: Send, color: '#25D366' },
  { key: 'email', label: 'Email Broadcast', icon: Mail, color: '#2563EB' },
  { key: 'telegram', label: 'Telegram Broadcast', icon: MessageCircle, color: '#0088CC' },
];

export default function BroadcastHub({ session, onBack, initialTab = 'whatsapp' }: BroadcastHubProps) {
  const [tab, setTab] = useState<BroadcastTab>(initialTab);

  return (
    <div>
      <div className="ah-tabbar">
        {TABS.map((t) => {
          const active = tab === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              className={`ah-tab ${active ? 'ah-tab-active' : ''}`}
              onClick={() => setTab(t.key)}
              style={active ? { borderBottomColor: t.color, color: t.color } : undefined}
            >
              <Icon size={17} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      <div className="ah-content">
        {tab === 'whatsapp' && <WhatsAppBroadcast session={session} onBack={onBack} />}
        {tab === 'email' && <EmailBroadcast session={session} onBack={onBack} />}
        {tab === 'telegram' && <TelegramBroadcast session={session} onBack={onBack} />}
      </div>
    </div>
  );
}
