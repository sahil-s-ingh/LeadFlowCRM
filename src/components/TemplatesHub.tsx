import { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ArrowLeft, FileText, MessageSquare } from 'lucide-react';
import MessageTemplates from '@/components/MessageTemplates';
import { TemplatesPage } from '@/components/CrmDashboard';

export default function TemplatesHub({ session, onBack }: { session: Session; onBack: () => void }) {
  const [subTab, setSubTab] = useState<'whatsapp' | 'email'>('whatsapp');

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 24px', borderBottom: '1px solid #e2e8f0', background: '#fff', position: 'sticky', top: 0, zIndex: 10 }}>
        <button
          onClick={onBack}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#fff', color: '#64748b', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#0f172a'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#64748b'; }}
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div style={{ display: 'flex', gap: '6px', marginLeft: '8px' }}>
          <button
            onClick={() => setSubTab('whatsapp')}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 16px',
              border: `1px solid ${subTab === 'whatsapp' ? '#22C55E' : '#e2e8f0'}`,
              borderRadius: '8px',
              background: subTab === 'whatsapp' ? 'rgba(34,197,94,0.08)' : '#fff',
              color: subTab === 'whatsapp' ? '#15803D' : '#64748b',
              fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
            }}
          >
            <MessageSquare size={16} /> WhatsApp Templates
          </button>
          <button
            onClick={() => setSubTab('email')}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 16px',
              border: `1px solid ${subTab === 'email' ? '#2563EB' : '#e2e8f0'}`,
              borderRadius: '8px',
              background: subTab === 'email' ? 'rgba(37,99,235,0.08)' : '#fff',
              color: subTab === 'email' ? '#2563EB' : '#64748b',
              fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
            }}
          >
            <FileText size={16} /> Email Templates
          </button>
        </div>
      </div>

      {subTab === 'whatsapp' ? (
        <MessageTemplates session={session} onBack={onBack} embedded />
      ) : (
        <TemplatesPage session={session} onBack={onBack} embedded />
      )}
    </div>
  );
}
