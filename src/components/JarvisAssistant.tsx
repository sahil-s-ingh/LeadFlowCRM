import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { Sparkles, X, Send, Loader2, AlertTriangle, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTED_QUESTIONS = [
  { label: 'How many follow-ups due today?', question: 'How many follow-ups are due today or overdue? Show me the list.' },
  { label: 'Show my recent leads', question: 'Show me my most recent leads with their status and lead score.' },
  { label: 'WhatsApp conversations needing reply', question: 'Which WhatsApp conversations need a reply? Show the most recent ones.' },
  { label: 'Lead status breakdown', question: 'What is the status breakdown of all my leads?' },
  { label: 'Top leads by score', question: 'Show me my top 5 leads by lead score.' },
  { label: 'Overdue follow-ups', question: 'Which follow-ups are overdue? List them with lead names.' },
];

// Minimal type declarations for the Web Speech API (not in standard TS lib)
interface SpeechRecognitionResultLike {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionEventLike {
  results: { [index: number]: SpeechRecognitionResultLike[] & { length: number; [index: number]: SpeechRecognitionResultLike } };
  resultIndex: number;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition?: { new (): SpeechRecognitionLike };
    webkitSpeechRecognition?: { new (): SpeechRecognitionLike };
  }
}

export default function JarvisAssistant({ session }: { session: Session | null }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speakingRef = useRef(false);

  const checkEnabled = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const { data } = await supabase
        .from('ai_assistant_config')
        .select('is_active, api_key, model')
        .limit(1)
        .maybeSingle();
      if (data) setEnabled(data.is_active && !!data.api_key && !!data.model);
      else setEnabled(false);
    } catch {
      setEnabled(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    checkEnabled();
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setVoiceSupported(!!SR && typeof window.speechSynthesis !== 'undefined');
  }, [checkEnabled]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const speak = useCallback((text: string) => {
    if (!voiceOn || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1;
    utter.pitch = 1;
    utter.lang = 'en-US';
    utter.onstart = () => { speakingRef.current = true; };
    utter.onend = () => { speakingRef.current = false; };
    window.speechSynthesis.speak(utter);
  }, [voiceOn]);

  const stopSpeaking = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      speakingRef.current = false;
    }
  }, []);

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    if (speakingRef.current) stopSpeaking();
    const rec = new SR();
    rec.lang = 'en-US';
    rec.continuous = false;
    rec.interimResults = false;
    rec.onstart = () => { setListening(true); };
    rec.onend = () => { setListening(false); };
    rec.onerror = () => { setListening(false); };
    rec.onresult = (e: SpeechRecognitionEventLike) => {
      const transcript = e.results[e.results.length - 1][0]?.transcript || '';
      if (transcript.trim()) sendQuestion(transcript.trim());
    };
    rec.start();
    recognitionRef.current = rec;
  }, [stopSpeaking]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    setListening(false);
  }, []);

  const sendQuestion = async (q: string) => {
    if (!q.trim() || loading || !session?.user?.id) return;
    if (listening) stopListening();
    stopSpeaking();
    const userMsg: Message = { role: 'user', content: q };
    const history = [...messages];
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setError('');
    setLoading(true);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/ai-assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          user_id: session.user.id,
          question: q,
          history: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        setMessages((prev) => [...prev, { role: 'assistant', content: data.error }]);
      } else if (data.reply) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
        speak(data.reply);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to get response';
      setError(msg);
      setMessages((prev) => [...prev, { role: 'assistant', content: `Sorry, I could not process that request: ${msg}` }]);
    } finally {
      setLoading(false);
    }
  };

  if (enabled === false || enabled === null) return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            position: 'fixed', bottom: '24px', right: '24px', zIndex: 9000,
            width: '56px', height: '56px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #2563eb, #1e40af)',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(37,99,235,0.35)',
            transition: 'transform 0.2s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          title="Ask Jarvis AI"
        >
          <Sparkles size={26} color="#fff" />
          <span style={{
            position: 'absolute', top: '-2px', right: '-2px',
            width: '12px', height: '12px', borderRadius: '50%',
            background: '#22c55e', border: '2px solid #fff',
          }} />
        </button>
      )}

      {open && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 9000,
          width: '400px', maxWidth: 'calc(100vw - 32px)', height: '560px', maxHeight: 'calc(100vh - 48px)',
          background: 'var(--bg-card, #fff)',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          border: '1px solid var(--border-subtle, #e2e8f0)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #2563eb, #1e40af)',
            padding: '14px 18px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: 'rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Sparkles size={20} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>Jarvis AI</div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: listening ? '#fbbf24' : '#22c55e',
                    animation: listening ? 'crm-pulse 1s infinite' : 'none',
                  }} />
                  {listening ? 'Listening...' : speakingRef.current ? 'Speaking...' : 'Online — CRM Assistant'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {voiceSupported && (
                <button
                  onClick={() => {
                    if (voiceOn) { stopSpeaking(); setVoiceOn(false); }
                    else setVoiceOn(true);
                  }}
                  style={{
                    background: voiceOn ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.1)',
                    border: 'none', cursor: 'pointer', borderRadius: '8px', padding: '6px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  title={voiceOn ? 'Voice replies on' : 'Voice replies off'}
                >
                  {voiceOn ? <Volume2 size={16} color="#22c55e" /> : <VolumeX size={16} color="#fff" />}
                </button>
              )}
              <button
                onClick={() => { stopSpeaking(); stopListening(); setOpen(false); }}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', borderRadius: '8px', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={18} color="#fff" />
              </button>
            </div>
          </div>

          <div
            ref={scrollRef}
            style={{
              flex: 1, overflowY: 'auto', padding: '16px',
              display: 'flex', flexDirection: 'column', gap: '12px',
              background: 'var(--bg-light, #f8fafc)',
            }}
          >
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px 8px' }}>
                <div style={{
                  width: '52px', height: '52px', borderRadius: '14px',
                  background: 'linear-gradient(135deg, #2563eb, #1e40af)',
                  margin: '0 auto 14px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Sparkles size={26} color="#fff" />
                </div>
                <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 4px' }}>
                  Hi, I'm Jarvis
                </p>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted, #64748b)', margin: '0 0 16px', lineHeight: 1.5 }}>
                  Your AI CRM assistant. Ask me about your leads, follow-ups, WhatsApp chats, and more. Type or tap the mic to speak.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {SUGGESTED_QUESTIONS.map((sq) => (
                    <button
                      key={sq.label}
                      onClick={() => sendQuestion(sq.question)}
                      style={{
                        padding: '10px 14px', borderRadius: '10px',
                        border: '1px solid var(--border-subtle, #e2e8f0)',
                        background: 'var(--bg-card, #fff)',
                        cursor: 'pointer', textAlign: 'left',
                        fontSize: '0.78rem', fontWeight: 500,
                        color: 'var(--text-main)',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.background = 'rgba(37,99,235,0.04)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle, #e2e8f0)'; e.currentTarget.style.background = 'var(--bg-card, #fff)'; }}
                    >
                      {sq.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth: '85%',
                  padding: '10px 14px',
                  borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: msg.role === 'user' ? '#2563eb' : 'var(--bg-card, #fff)',
                  color: msg.role === 'user' ? '#fff' : 'var(--text-main)',
                  fontSize: '0.82rem',
                  lineHeight: 1.5,
                  border: msg.role === 'user' ? 'none' : '1px solid var(--border-subtle, #e2e8f0)',
                  whiteSpace: 'pre-wrap',
                }}>
                  {msg.role === 'user' && msg.content.startsWith('\u{1F3A4}') ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Mic size={13} /> {msg.content.replace(/^\u{1F3A4}\s*/, '')}
                    </span>
                  ) : msg.role === 'assistant' ? (
                    <span>
                      {msg.content}
                      {voiceOn && i === messages.length - 1 && (
                        <button
                          onClick={() => speak(msg.content)}
                          style={{
                            marginLeft: '8px', background: 'none', border: 'none', cursor: 'pointer',
                            padding: '2px', display: 'inline-flex', alignItems: 'center',
                            verticalAlign: 'middle', opacity: 0.6,
                          }}
                          title="Play voice"
                        >
                          <Volume2 size={13} color="#2563eb" />
                        </button>
                      )}
                    </span>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  padding: '10px 14px', borderRadius: '14px 14px 14px 4px',
                  background: 'var(--bg-card, #fff)', border: '1px solid var(--border-subtle, #e2e8f0)',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  <Loader2 size={16} className="crm-spin" style={{ color: '#2563eb' }} />
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, #64748b)' }}>Thinking...</span>
                </div>
              </div>
            )}

            {error && !loading && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', background: 'rgba(239,68,68,0.06)', borderRadius: '8px', fontSize: '0.72rem', color: '#dc2626' }}>
                <AlertTriangle size={12} /> {error}
              </div>
            )}
          </div>

          <div style={{
            padding: '12px 14px', borderTop: '1px solid var(--border-subtle, #e2e8f0)',
            background: 'var(--bg-card, #fff)', flexShrink: 0,
            display: 'flex', gap: '8px', alignItems: 'center',
          }}>
            {voiceSupported && (
              <button
                onClick={listening ? stopListening : startListening}
                disabled={loading}
                style={{
                  width: '40px', height: '40px', borderRadius: '10px',
                  border: 'none',
                  background: listening ? '#ef4444' : (loading ? '#94a3b8' : 'rgba(37,99,235,0.1)'),
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'background 0.15s',
                }}
                title={listening ? 'Stop listening' : 'Speak to Jarvis'}
              >
                {listening ? <MicOff size={18} color="#fff" /> : <Mic size={18} color="#2563eb" />}
              </button>
            )}
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQuestion(input); } }}
              placeholder={listening ? 'Listening...' : 'Ask Jarvis anything about your CRM...'}
              disabled={loading || listening}
              style={{
                flex: 1, padding: '10px 12px', borderRadius: '10px',
                border: `1px solid ${listening ? 'rgba(239,68,68,0.3)' : 'var(--border-subtle, #e2e8f0)'}`,
                background: 'var(--bg-light, #f8fafc)',
                fontSize: '0.82rem', color: 'var(--text-main)',
                outline: 'none',
              }}
            />
            <button
              onClick={() => sendQuestion(input)}
              disabled={loading || !input.trim()}
              style={{
                width: '40px', height: '40px', borderRadius: '10px',
                border: 'none', background: loading || !input.trim() ? '#94a3b8' : '#2563eb',
                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'background 0.15s',
              }}
            >
              {loading ? <Loader2 size={18} className="crm-spin" color="#fff" /> : <Send size={18} color="#fff" />}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
