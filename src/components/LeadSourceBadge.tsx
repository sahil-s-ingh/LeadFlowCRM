import React from 'react';
import { SourceLogo, SOURCE_META } from '@/components/BrandLogos';
import { Globe, ArrowUpRight, FileText, Upload, UserPlus, Webhook, HelpCircle } from 'lucide-react';

type Props = { source?: string | null; size?: number; showLabel?: boolean };

const FALLBACK_ICONS: Record<string, React.FC<{ size?: number; color?: string }>> = {
  'Landing Page': Globe,
  'Direct Link': ArrowUpRight,
  'Popup Form': FileText,
  'Bulk Upload': Upload,
  'Manual Entry': UserPlus,
  'Webhook': Webhook,
};

const LeadSourceBadge: React.FC<Props> = ({ source, size = 16, showLabel = true }) => {
  const s = source || 'Landing Page';
  const meta = SOURCE_META[s] || SOURCE_META['Unknown'];
  const brandIcon = <SourceLogo source={s} size={size} />;
  const FallbackIcon = FALLBACK_ICONS[s] || HelpCircle;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        fontSize: '0.72rem',
        fontWeight: 600,
        color: meta.color,
        background: meta.bgColor,
        padding: '3px 8px',
        borderRadius: '6px',
        whiteSpace: 'nowrap',
      }}
    >
      {brandIcon || <FallbackIcon size={size - 2} color={meta.color} />}
      {showLabel && meta.label}
    </span>
  );
};

export default LeadSourceBadge;
