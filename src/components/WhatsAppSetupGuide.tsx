import { useState } from 'react';
import {
  ChevronDown, CheckCircle2, ExternalLink, ShieldCheck, KeyRound,
  BadgeCheck, Building2, Clock, AlertCircle, BookOpen,
} from 'lucide-react';

interface Props {
  feature: 'groups' | 'flows';
}

const STEPS = [
  {
    icon: Building2,
    title: 'Complete Business Verification',
    desc: 'Go to business.facebook.com, open Business Settings, then Business Info. Click Start Verification under Business Verification. Provide your legal business name, address, phone number, and a business document (utility bill, tax certificate, or bank statement). Meta reviews it within 1-5 business days.',
    link: 'https://business.facebook.com/settings/info',
    linkText: 'Open Business Settings',
  },
  {
    icon: KeyRound,
    title: 'Enable Two-Step Verification',
    desc: 'In WhatsApp Manager (All Tools), find your phone number and open its Profile. If Two-step verification is off, turn it on and set a PIN. This is mandatory — the OBA request cannot be submitted without it.',
  },
  {
    icon: BadgeCheck,
    title: 'Get Your Display Name Approved',
    desc: 'In WhatsApp Manager, check your phone number Profile. The display name must be approved by Meta. It should match your business name exactly or a close variation. If already approved (you have been sending messages), skip this step.',
  },
  {
    icon: ShieldCheck,
    title: 'Submit the Official Business Account Request',
    desc: 'In WhatsApp Manager, find your phone number Profile, scroll to Official business account, and click Submit Request. Enter your business name, website link, and a brief description. Meta looks for notable brands with a recognized presence — having a website, social media accounts with followers, press coverage, or official registration all help.',
    link: 'https://developers.facebook.com/documentation/business-messaging/whatsapp/official-business-accounts',
    linkText: 'OBA Requirements',
  },
  {
    icon: Clock,
    title: 'Wait for Approval',
    desc: 'Review time varies from a few days to a couple of weeks. You will get a notification in WhatsApp Manager once approved. If rejected, you can reapply after 30 days.',
  },
];

const PREREQUISITES = [
  'Your business complies with the WhatsApp Business Messaging Policy',
  'Your number has been registered on the WhatsApp Business Platform for at least 30 days',
  'Business Verification is complete through Meta',
  'Two-step verification is enabled on your phone number',
  'Your display name has been approved by Meta',
];

export default function WhatsAppSetupGuide({ feature }: Props) {
  const [expanded, setExpanded] = useState(false);

  const featureLabel = feature === 'groups' ? 'Groups' : 'Flows';
  const featureLower = feature === 'groups' ? 'groups' : 'flows';

  return (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: '12px',
      border: '1px solid var(--border-light)',
      overflow: 'hidden',
      marginBottom: '20px',
    }}>
      {/* Header bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          padding: '14px 20px',
          background: 'rgba(37,211,102,0.06)',
          border: 'none',
          borderBottom: expanded ? '1px solid var(--border-light)' : 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: 'rgba(37,211,102,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <BookOpen size={16} style={{ color: '#25D366' }} />
          </div>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Getting {featureLabel} API Access — Step by Step Guide
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1px' }}>
              Your WhatsApp number needs Official Business Account (OBA) status to use {featureLower}
            </div>
          </div>
        </div>
        <ChevronDown
          size={18}
          style={{
            color: 'var(--text-muted)',
            transition: 'transform 0.2s ease',
            transform: expanded ? 'rotate(180deg)' : 'none',
            flexShrink: 0,
          }}
        />
      </button>

      {expanded && (
        <div style={{ padding: '20px' }}>
          {/* What is OBA banner */}
          <div style={{
            display: 'flex', gap: '12px', alignItems: 'flex-start',
            padding: '14px 16px', borderRadius: '10px',
            background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
            marginBottom: '20px',
          }}>
            <AlertCircle size={20} style={{ color: '#3b82f6', flexShrink: 0, marginTop: '1px' }} />
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                What is an Official Business Account (OBA)?
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                An OBA is a WhatsApp Business number with the blue verified badge next to the business name.
                Meta grants this status to verified, notable businesses. Both {featureLabel} and Groups APIs require OBA status —
                without it, Meta will reject API requests with an eligibility error.
              </div>
            </div>
          </div>

          {/* Prerequisites checklist */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Prerequisites (all five must be met before applying)
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {PREREQUISITES.map((req, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <CheckCircle2 size={16} style={{ color: '#25D366', flexShrink: 0, marginTop: '1px' }} />
                  <span style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>{req}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Step-by-step */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex', gap: '14px', alignItems: 'flex-start',
                    padding: '16px', borderRadius: '10px',
                    background: 'var(--bg-secondary)', border: '1px solid var(--border-light)',
                  }}
                >
                  {/* Step number badge */}
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    background: 'rgba(37,211,102,0.12)', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexDirection: 'column',
                  }}>
                    <Icon size={16} style={{ color: '#25D366' }} />
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{
                        fontSize: '0.7rem', fontWeight: 700, color: '#25D366',
                        padding: '1px 8px', borderRadius: '20px', background: 'rgba(37,211,102,0.12)',
                      }}>
                        STEP {i + 1}
                      </span>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {step.title}
                      </h4>
                    </div>
                    <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: '8px' }}>
                      {step.desc}
                    </p>
                    {step.link && (
                      <a
                        href={step.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: '0.8rem', color: '#25D366', fontWeight: 600,
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          textDecoration: 'none',
                        }}
                      >
                        {step.linkText} <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick facts */}
          {feature === 'groups' && (
            <div style={{
              marginTop: '24px', padding: '16px', borderRadius: '10px',
              background: 'rgba(37,211,102,0.05)', border: '1px solid rgba(37,211,102,0.15)',
            }}>
              <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px' }}>
                Quick Facts — Groups API
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                <Fact label="Max participants" value="8 per group" />
                <Fact label="Max groups" value="10,000 per number" />
                <Fact label="Join model" value="Invite link only" />
                <Fact label="Messages" value="Text, media, templates" />
              </div>
            </div>
          )}

          {feature === 'flows' && (
            <div style={{
              marginTop: '24px', padding: '16px', borderRadius: '10px',
              background: 'rgba(37,211,102,0.05)', border: '1px solid rgba(37,211,102,0.15)',
            }}>
              <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px' }}>
                Quick Facts — Flows API
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                <Fact label="Max screens" value="10 per flow" />
                <Fact label="Flow types" value="Static & Dynamic (endpoint)" />
                <Fact label="Delivery" value="In-chat interactive message" />
                <Fact label="Data" value="Submitted via webhook automatically" />
              </div>
            </div>
          )}

          {/* Help links */}
          <div style={{
            marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-light)',
            display: 'flex', gap: '16px', flexWrap: 'wrap',
          }}>
            <a
              href={feature === 'groups'
                ? 'https://developers.facebook.com/documentation/business-messaging/whatsapp/groups'
                : 'https://developers.facebook.com/docs/whatsapp/flows'}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '0.8rem', color: '#3b82f6', fontWeight: 600,
                display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none',
              }}
            >
              {featureLabel} API Documentation <ExternalLink size={13} />
            </a>
            <a
              href="https://developers.facebook.com/documentation/business-messaging/whatsapp/official-business-accounts"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '0.8rem', color: '#3b82f6', fontWeight: 600,
                display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none',
              }}
            >
              OBA Eligibility Guide <ExternalLink size={13} />
            </a>
            <a
              href="https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/get-started"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '0.8rem', color: '#3b82f6', fontWeight: 600,
                display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none',
              }}
            >
              Get Started Guide <ExternalLink size={13} />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '2px',
      padding: '8px 10px', borderRadius: '8px', background: 'var(--bg-card)',
    }}>
      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 600 }}>{value}</span>
    </div>
  );
}
