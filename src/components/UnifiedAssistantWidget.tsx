import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { MessageSquare, X, Send, Users, Circle, Sparkles, Mic, MicOff, Volume2, VolumeX, Loader2, AlertTriangle, Bot } from 'lucide-react';

interface TeamChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  message_text: string;
  created_at: string;
}

interface TeamMemberInfo {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  status: string;
}

interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface UnifiedAssistantWidgetProps {
  session: Session;
  userRole: string;
}

const ROLE_COLORS: Record<string, string> = {
  owner: '#EAB308',
  admin: '#3B82F6',
  manager: '#22C55E',
  agent: '#06B6D4',
};

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  agent: 'Agent',
};

const SUGGESTED_QUESTIONS = [
  { label: 'How many follow-ups due today?', question: 'How many follow-ups are due today or overdue? Show me the list.' },
  { label: 'Show my recent leads', question: 'Show me my most recent leads with their status and lead score.' },
  { label: 'WhatsApp conversations needing reply', question: 'Which WhatsApp conversations need a reply? Show the most recent ones.' },
  { label: 'Lead status breakdown', question: 'What is the status breakdown of all my leads?' },
  { label: 'Top leads by score', question: 'Show me my top 5 leads by lead score.' },
  { label: 'Overdue follow-ups', question: 'Which follow-ups are overdue? List them with lead names.' },
];

// Minimal Web Speech API type declarations
interface SpeechRecognitionResultLike { transcript: string; confidence: number; }
interface SpeechRecognitionEventLike {
  results: { [index: number]: SpeechRecognitionResultLike[] & { length: number; [index: number]: SpeechRecognitionResultLike } };
  resultIndex: number;
}
interface SpeechRecognitionLike {
  lang: string; continuous: boolean; interimResults: boolean;
  start: () => void; stop: () => void; abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null; onstart: (() => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition?: { new (): SpeechRecognitionLike };
    webkitSpeechRecognition?: { new (): SpeechRecognitionLike };
  }
}

type Mode = 'team' | 'ai';

export default function UnifiedAssistantWidget({ session, userRole }: UnifiedAssistantWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('team');

  // Team chat state
  const [teamMessages, setTeamMessages] = useState<TeamChatMessage[]>([]);
  const [teamInput, setTeamInput] = useState('');
  const [teamLoading, setTeamLoading] = useState(true);
  const [teamSending, setTeamSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [teamOwnerId, setTeamOwnerId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [teamMembers, setTeamMembers] = useState<TeamMemberInfo[]>([]);
  const [showMembersList, setShowMembersList] = useState(false);
  const teamScrollRef = useRef<HTMLDivElement>(null);

  // AI state
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const aiScrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speakingRef = useRef(false);

  // Position (draggable FAB)
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = localStorage.getItem('unified-assistant-pos');
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return { x: window.innerWidth - 80, y: window.innerHeight - 80 };
  });
  const [dragging, setDragging] = useState(false);
  const dragData = useRef<{ startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);
  const wasDragged = useRef(false);
  const posRef = useRef(pos);
  posRef.current = pos;

  const resolveTeamOwner = useCallback(async (): Promise<string | null> => {
    if (userRole === 'owner') return session.user.id;
    const { data } = await supabase
      .from('team_members')
      .select('owner_id')
      .eq('email', session.user.email || '')
      .maybeSingle();
    return (data as { owner_id: string } | null)?.owner_id || null;
  }, [userRole, session.user.id, session.user.email]);

  // Load team chat
  useEffect(() => {
    (async () => {
      const ownerId = await resolveTeamOwner();
      if (!ownerId) { setTeamLoading(false); return; }
      setTeamOwnerId(ownerId);

      const { data: msgData, error } = await supabase
        .from('team_chat_messages')
        .select('*')
        .eq('team_owner_id', ownerId)
        .order('created_at', { ascending: true })
        .limit(100);
      if (!error && msgData) setTeamMessages(msgData as TeamChatMessage[]);
      setTeamLoading(false);

      const { data: membersData } = await supabase
        .from('team_members')
        .select('id, email, full_name, role, status')
        .eq('owner_id', ownerId);
      const members = (membersData || []) as TeamMemberInfo[];
      setTeamMembers(members);

      const cur = members.find((m) => m.email === session.user.email);
      if (cur && cur.full_name) setDisplayName(cur.full_name);
      else if (userRole === 'owner') {
        const metaName = session.user.user_metadata?.full_name || session.user.user_metadata?.name;
        setDisplayName(metaName || session.user.email?.split('@')[0] || 'Owner');
      } else setDisplayName(session.user.email?.split('@')[0] || 'Team Member');
    })();
  }, [resolveTeamOwner, session.user.email, session.user.user_metadata, userRole]);

  // Team chat realtime
  useEffect(() => {
    if (!teamOwnerId) return;
    const channel = supabase
      .channel('team-chat-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'team_chat_messages', filter: `team_owner_id=eq.${teamOwnerId}` }, (payload) => {
        const newMsg = payload.new as TeamChatMessage;
        setTeamMessages((prev) => prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]);
        if (newMsg.sender_id !== session.user.id && (!isOpen || mode !== 'team')) {
          setUnreadCount((c) => c + 1);
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'team_chat_messages', filter: `team_owner_id=eq.${teamOwnerId}` }, (payload) => {
        const deletedId = (payload.old as TeamChatMessage).id;
        setTeamMessages((prev) => prev.filter((m) => m.id !== deletedId));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [teamOwnerId, isOpen, mode, session.user.id]);

  // Check AI enabled
  useEffect(() => {
    (async () => {
      if (!session?.user?.id) return;
      try {
        const { data } = await supabase
          .from('ai_assistant_config')
          .select('is_active, api_key, model')
          .limit(1)
          .maybeSingle();
        setAiEnabled(data ? data.is_active && !!data.api_key && !!data.model : false);
      } catch { setAiEnabled(false); }
    })();
  }, [session?.user?.id]);

  // Voice support
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setVoiceSupported(!!SR && typeof window.speechSynthesis !== 'undefined');
  }, []);

  // Dragging
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const d = dragData.current; if (!d) return;
      const dx = e.clientX - d.startX, dy = e.clientY - d.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) d.moved = true;
      setPos({ x: Math.max(8, Math.min(window.innerWidth - 64, d.origX + dx)), y: Math.max(8, Math.min(window.innerHeight - 64, d.origY + dy)) });
    };
    const onUp = () => {
      const d = dragData.current; const moved = d?.moved;
      dragData.current = null; setDragging(false);
      if (moved) { try { localStorage.setItem('unified-assistant-pos', JSON.stringify(posRef.current)); } catch { /* ignore */ } wasDragged.current = true; }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging]);

  // Auto-scroll
  useEffect(() => { if (teamScrollRef.current) teamScrollRef.current.scrollTop = teamScrollRef.current.scrollHeight; }, [teamMessages]);
  useEffect(() => { if (aiScrollRef.current) aiScrollRef.current.scrollTop = aiScrollRef.current.scrollHeight; }, [aiMessages, aiLoading]);

  // Reset unread when opening team tab
  useEffect(() => { if (isOpen && mode === 'team') setUnreadCount(0); }, [isOpen, mode]);

  const handleTeamSend = async () => {
    const text = teamInput.trim();
    if (!text || !teamOwnerId || teamSending) return;
    setTeamSending(true); setTeamInput('');
    const role = userRole === 'owner' ? 'owner' : userRole;
    const { error } = await supabase.from('team_chat_messages').insert({
      team_owner_id: teamOwnerId, sender_id: session.user.id, sender_name: displayName, sender_role: role, message_text: text,
    });
    if (error) setTeamInput(text);
    else {
      try {
        const token = (await supabase.auth.getSession()).session?.access_token;
        if (token) {
          await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-chat-notification`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ sender_id: session.user.id, sender_name: displayName, message_text: text, team_owner_id: teamOwnerId }),
          });
        }
      } catch { /* non-fatal */ }
    }
    setTeamSending(false);
  };

  const speak = useCallback((text: string) => {
    if (!voiceOn || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1; utter.pitch = 1; utter.lang = 'en-US';
    utter.onstart = () => { speakingRef.current = true; };
    utter.onend = () => { speakingRef.current = false; };
    window.speechSynthesis.speak(utter);
  }, [voiceOn]);

  const stopSpeaking = useCallback(() => { if ('speechSynthesis' in window) { window.speechSynthesis.cancel(); speakingRef.current = false; } }, []);

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    if (speakingRef.current) stopSpeaking();
    const rec = new SR();
    rec.lang = 'en-US'; rec.continuous = false; rec.interimResults = false;
    rec.onstart = () => { setListening(true); };
    rec.onend = () => { setListening(false); };
    rec.onerror = () => { setListening(false); };
    rec.onresult = (e: SpeechRecognitionEventLike) => {
      const transcript = e.results[e.results.length - 1][0]?.transcript || '';
      if (transcript.trim()) sendAiQuestion(transcript.trim());
    };
    rec.start();
    recognitionRef.current = rec;
  }, [stopSpeaking]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch { /* ignore */ } recognitionRef.current = null; }
    setListening(false);
  }, []);

  const sendAiQuestion = async (q: string) => {
    if (!q.trim() || aiLoading || !session?.user?.id) return;
    if (listening) stopListening();
    stopSpeaking();
    const userMsg: AIMessage = { role: 'user', content: q };
    const history = [...aiMessages];
    setAiMessages((prev) => [...prev, userMsg]);
    setAiInput(''); setAiError(''); setAiLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ user_id: session.user.id, question: q, history: history.map((m) => ({ role: m.role, content: m.content })) }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      if (data.error) { setAiError(data.error); setAiMessages((prev) => [...prev, { role: 'assistant', content: data.error }]); }
      else if (data.reply) { setAiMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]); speak(data.reply); }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to get response';
      setAiError(msg);
      setAiMessages((prev) => [...prev, { role: 'assistant', content: `Sorry, I could not process that request: ${msg}` }]);
    } finally { setAiLoading(false); }
  };

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const isOwnTeamMessage = (msg: TeamChatMessage) => msg.sender_id === session.user.id;

  const memberNameMap: Record<string, string> = {};
  teamMembers.forEach((m) => { memberNameMap[m.email] = m.full_name || m.email.split('@')[0]; });
  const resolveSenderName = (msg: TeamChatMessage): string => {
    const memberByEmail = teamMembers.find((m) => m.email === msg.sender_name || m.email.split('@')[0] === msg.sender_name);
    if (memberByEmail && memberByEmail.full_name) return memberByEmail.full_name;
    return msg.sender_name;
  };

  const activeMembers = teamMembers.filter((m) => m.status === 'active');
  const showAi = aiEnabled !== false && aiEnabled !== null;

  // FAB color depends on mode
  const fabGradient = mode === 'team'
    ? 'linear-gradient(135deg, #0891b2, #0e7490)'
    : 'linear-gradient(135deg, #2563eb, #1e40af)';

  const startDrag = (e: React.MouseEvent) => {
    dragData.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y, moved: false };
    setDragging(true);
  };

  const handleFabClick = () => {
    if (wasDragged.current) { wasDragged.current = false; return; }
    setIsOpen((v) => !v);
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <div
          onMouseDown={startDrag}
          onClick={handleFabClick}
          style={{
            position: 'fixed', left: `${pos.x}px`, top: `${pos.y}px`, zIndex: 9000,
            width: '56px', height: '56px', borderRadius: '50%',
            background: fabGradient, cursor: dragging ? 'grabbing' : 'grab',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            transition: dragging ? 'none' : 'transform 0.2s',
            userSelect: 'none', transform: dragging ? 'scale(1.12)' : undefined,
          }}
          onMouseEnter={(e) => { if (!dragging) e.currentTarget.style.transform = 'scale(1.08)'; }}
          onMouseLeave={(e) => { if (!dragging) e.currentTarget.style.transform = 'scale(1)'; }}
          title="Open Assistant — drag to move"
        >
          {mode === 'team' ? <MessageSquare size={26} color="#fff" /> : <Sparkles size={26} color="#fff" />}
          {unreadCount > 0 && (
            <span style={{ position: 'absolute', top: '-2px', right: '-2px', minWidth: '20px', height: '20px', borderRadius: '10px', background: '#ef4444', color: '#fff', fontSize: '0.65rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', border: '2px solid #fff' }}>{unreadCount}</span>
          )}
          <span style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '14px', height: '14px', borderRadius: '50%', background: '#22c55e', border: '2px solid #fff' }} />
        </div>
      )}

      {/* Unified Panel */}
      {isOpen && (
        <div style={{
          position: 'fixed', left: `${Math.min(pos.x, window.innerWidth - 420)}px`, top: `${Math.min(pos.y, window.innerHeight - 580)}px`, zIndex: 9000,
          width: '400px', maxWidth: 'calc(100vw - 48px)', height: '560px', maxHeight: 'calc(100vh - 48px)',
          background: 'var(--bg-card, #fff)', borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)', border: '1px solid var(--border-subtle, #e2e8f0)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Header with mode tabs */}
          <div style={{
            background: mode === 'team' ? 'linear-gradient(135deg, #0891b2, #0e7490)' : 'linear-gradient(135deg, #2563eb, #1e40af)',
            padding: '0', flexShrink: 0, userSelect: 'none',
          }}
          onMouseDown={startDrag}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px 0 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {mode === 'team' ? <MessageSquare size={20} color="#fff" /> : <Sparkles size={20} color="#fff" />}
              </div>
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>
                  {mode === 'team' ? 'Team Chat' : 'Jarvis AI'}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.75)' }}>
                  {mode === 'team'
                    ? `${activeMembers.length + (userRole === 'owner' ? 1 : 0)} members in team`
                    : (listening ? 'Listening...' : speakingRef.current ? 'Speaking...' : 'Online — CRM Assistant')}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {mode === 'ai' && voiceSupported && (
                <button onClick={() => { if (voiceOn) { stopSpeaking(); setVoiceOn(false); } else setVoiceOn(true); }} style={{ background: voiceOn ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', borderRadius: '8px', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={voiceOn ? 'Voice replies on' : 'Voice replies off'}>
                  {voiceOn ? <Volume2 size={16} color="#22c55e" /> : <VolumeX size={16} color="#fff" />}
                </button>
              )}
              {mode === 'team' && (
                <button onClick={() => setShowMembersList((v) => !v)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', borderRadius: '8px', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Team members">
                  <Users size={16} color="#fff" />
                </button>
              )}
              <button onClick={() => { stopSpeaking(); stopListening(); setIsOpen(false); }} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', borderRadius: '8px', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} color="#fff" />
              </button>
            </div>
          </div>

          {/* Tab switcher */}
          <div style={{ display: 'flex', padding: '8px 10px 0', gap: '4px' }}>
            <button
              onClick={() => { setMode('team'); setUnreadCount(0); }}
              style={{
                flex: 1, padding: '7px 10px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
                background: mode === 'team' ? 'var(--bg-card, #fff)' : 'rgba(255,255,255,0.12)',
                color: mode === 'team' ? '#0891b2' : '#fff',
                fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                transition: 'all 0.15s',
              }}
            >
              <MessageSquare size={14} /> Team Chat
              {unreadCount > 0 && mode !== 'team' && (
                <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.6rem', fontWeight: 700, borderRadius: '8px', padding: '1px 6px' }}>{unreadCount}</span>
              )}
            </button>
            {showAi && (
              <button
                onClick={() => setMode('ai')}
                style={{
                  flex: 1, padding: '7px 10px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
                  background: mode === 'ai' ? 'var(--bg-card, #fff)' : 'rgba(255,255,255,0.12)',
                  color: mode === 'ai' ? '#2563eb' : '#fff',
                  fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                  transition: 'all 0.15s',
                }}
              >
                <Sparkles size={14} /> AI Assistant
              </button>
            )}
          </div>
        </div>

        {/* Members list dropdown (team mode) */}
        {mode === 'team' && showMembersList && (
          <div style={{ maxHeight: '200px', overflowY: 'auto', borderBottom: '1px solid var(--border-subtle, #e2e8f0)', background: 'var(--bg-light, #f8fafc)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', position: 'sticky', top: 0, background: 'var(--bg-light, #f8fafc)', borderBottom: '1px solid var(--border-subtle, #e2e8f0)' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)' }}>Team Members</span>
              <button onClick={() => setShowMembersList(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}><X size={14} color="var(--text-muted)" /></button>
            </div>
            <div style={{ padding: '4px 10px 8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 4px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: `${ROLE_COLORS.owner}22`, color: ROLE_COLORS.owner, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>{(session.user.email?.charAt(0) || 'O').toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)' }}>{userRole === 'owner' ? (displayName || 'You') : 'Owner'}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.user.email}</div>
                </div>
                <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '2px 7px', borderRadius: '6px', background: `${ROLE_COLORS.owner}15`, color: ROLE_COLORS.owner }}>Owner</span>
              </div>
              {teamMembers.map((m) => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 4px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: `${ROLE_COLORS[m.role] || ROLE_COLORS.agent}22`, color: ROLE_COLORS[m.role] || ROLE_COLORS.agent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>{(m.full_name || m.email).charAt(0).toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)' }}>{m.full_name || m.email.split('@')[0]}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</div>
                  </div>
                  <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '2px 7px', borderRadius: '6px', background: `${ROLE_COLORS[m.role] || ROLE_COLORS.agent}15`, color: ROLE_COLORS[m.role] || ROLE_COLORS.agent }}>{ROLE_LABELS[m.role] || m.role}</span>
                  <Circle size={7} fill={m.status === 'active' ? '#22C55E' : '#94A3B8'} style={{ color: 'transparent', flexShrink: 0 }} />
                </div>
              ))}
              {teamMembers.length === 0 && (
                <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                  <Users size={24} style={{ opacity: 0.2, marginBottom: 6 }} />
                  <p>No team members yet. Invite them from Settings.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Team Chat body */}
        {mode === 'team' && (
          <>
            <div ref={teamScrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', background: 'var(--bg-light, #f8fafc)' }}>
              {teamLoading ? (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                  <Loader2 size={22} className="crm-spin" style={{ marginBottom: 8, color: '#0891b2' }} /> Loading messages...
                </div>
              ) : teamMessages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                  <MessageSquare size={32} style={{ opacity: 0.2, marginBottom: 8 }} />
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                teamMessages.map((msg, i) => {
                  const own = isOwnTeamMessage(msg);
                  const prevMsg = teamMessages[i - 1];
                  const showAvatar = !prevMsg || prevMsg.sender_id !== msg.sender_id;
                  const roleColor = ROLE_COLORS[msg.sender_role] || '#06B6D4';
                  const senderName = own ? displayName : resolveSenderName(msg);
                  return (
                    <div key={msg.id} style={{ display: 'flex', justifyContent: own ? 'flex-end' : 'flex-start', marginBottom: showAvatar ? '10px' : '2px', gap: '8px' }}>
                      {!own && showAvatar && (
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: `${roleColor}22`, color: roleColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>{senderName.charAt(0).toUpperCase()}</div>
                      )}
                      <div style={{ maxWidth: '75%' }}>
                        {showAvatar && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: own ? 'var(--text-main)' : roleColor }}>{own ? 'You' : senderName}</span>
                            {!own && <span style={{ fontSize: '0.58rem', fontWeight: 600, padding: '1px 5px', borderRadius: '4px', background: `${roleColor}15`, color: roleColor }}>{ROLE_LABELS[msg.sender_role] || msg.sender_role}</span>}
                            <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{formatTime(msg.created_at)}</span>
                          </div>
                        )}
                        <div style={{ padding: '8px 12px', borderRadius: own ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: own ? '#0891b2' : 'var(--bg-card, #fff)', color: own ? '#fff' : 'var(--text-main)', fontSize: '0.8rem', lineHeight: 1.45, border: own ? 'none' : '1px solid var(--border-subtle, #e2e8f0)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.message_text}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border-subtle, #e2e8f0)', background: 'var(--bg-card, #fff)', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <textarea
                placeholder="Type a message to your team..."
                value={teamInput}
                onChange={(e) => setTeamInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTeamSend(); } }}
                rows={1}
                disabled={teamSending}
                style={{ flex: 1, padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-subtle, #e2e8f0)', background: 'var(--bg-light, #f8fafc)', fontSize: '0.82rem', color: 'var(--text-main)', outline: 'none', resize: 'none', fontFamily: 'inherit' }}
              />
              <button onClick={handleTeamSend} disabled={!teamInput.trim() || teamSending} style={{ width: '40px', height: '40px', borderRadius: '10px', border: 'none', background: !teamInput.trim() || teamSending ? '#94a3b8' : '#0891b2', cursor: !teamInput.trim() || teamSending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} aria-label="Send">
                <Send size={18} color="#fff" />
              </button>
            </div>
          </>
        )}

        {/* AI Assistant body */}
        {mode === 'ai' && showAi && (
          <>
            <div ref={aiScrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--bg-light, #f8fafc)' }}>
              {aiMessages.length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px 8px' }}>
                  <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'linear-gradient(135deg, #2563eb, #1e40af)', margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Sparkles size={26} color="#fff" />
                  </div>
                  <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 4px' }}>Hi, I'm Jarvis</p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted, #64748b)', margin: '0 0 16px', lineHeight: 1.5 }}>Your AI CRM assistant. Ask me about your leads, follow-ups, WhatsApp chats, and more.</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {SUGGESTED_QUESTIONS.map((sq) => (
                      <button key={sq.label} onClick={() => sendAiQuestion(sq.question)} style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-subtle, #e2e8f0)', background: 'var(--bg-card, #fff)', cursor: 'pointer', textAlign: 'left', fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-main)', transition: 'all 0.15s' }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.background = 'rgba(37,99,235,0.04)'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle, #e2e8f0)'; e.currentTarget.style.background = 'var(--bg-card, #fff)'; }}>{sq.label}</button>
                    ))}
                  </div>
                </div>
              )}
              {aiMessages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', maxWidth: '85%' }}>
                    {msg.role === 'assistant' && <div style={{ width: '26px', height: '26px', borderRadius: '8px', background: 'linear-gradient(135deg, #2563eb, #1e40af)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}><Bot size={15} color="#fff" /></div>}
                    <div style={{ padding: '10px 14px', borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: msg.role === 'user' ? '#2563eb' : 'var(--bg-card, #fff)', color: msg.role === 'user' ? '#fff' : 'var(--text-main)', fontSize: '0.82rem', lineHeight: 1.5, border: msg.role === 'user' ? 'none' : '1px solid var(--border-subtle, #e2e8f0)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {msg.role === 'assistant' && voiceOn && i === aiMessages.length - 1 ? (
                        <span>{msg.content}<button onClick={() => speak(msg.content)} style={{ marginLeft: '8px', background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle', opacity: 0.6 }} title="Play voice"><Volume2 size={13} color="#2563eb" /></button></span>
                      ) : msg.content}
                    </div>
                  </div>
                </div>
              ))}
              {aiLoading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '26px', height: '26px', borderRadius: '8px', background: 'linear-gradient(135deg, #2563eb, #1e40af)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Bot size={15} color="#fff" /></div>
                    <div style={{ padding: '10px 14px', borderRadius: '14px 14px 14px 4px', background: 'var(--bg-card, #fff)', border: '1px solid var(--border-subtle, #e2e8f0)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Loader2 size={16} className="crm-spin" style={{ color: '#2563eb' }} />
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, #64748b)' }}>Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              {aiError && !aiLoading && aiMessages.length > 0 && aiMessages[aiMessages.length - 1].role === 'assistant' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', background: 'rgba(239,68,68,0.06)', borderRadius: '8px', fontSize: '0.72rem', color: '#dc2626' }}>
                  <AlertTriangle size={12} /> {aiError}
                </div>
              )}
            </div>
            <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border-subtle, #e2e8f0)', background: 'var(--bg-card, #fff)', display: 'flex', gap: '8px', alignItems: 'center' }}>
              {voiceSupported && (
                <button onClick={listening ? stopListening : startListening} disabled={aiLoading} style={{ width: '40px', height: '40px', borderRadius: '10px', border: 'none', background: listening ? '#ef4444' : (aiLoading ? '#94a3b8' : 'rgba(37,99,235,0.1)'), cursor: aiLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} title={listening ? 'Stop listening' : 'Speak to Jarvis'}>
                  {listening ? <MicOff size={18} color="#fff" /> : <Mic size={18} color="#2563eb" />}
                </button>
              )}
              <input type="text" value={aiInput} onChange={(e) => setAiInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAiQuestion(aiInput); } }} placeholder={listening ? 'Listening...' : 'Ask Jarvis anything...'} disabled={aiLoading || listening} style={{ flex: 1, padding: '10px 12px', borderRadius: '10px', border: `1px solid ${listening ? 'rgba(239,68,68,0.3)' : 'var(--border-subtle, #e2e8f0)'}`, background: 'var(--bg-light, #f8fafc)', fontSize: '0.82rem', color: 'var(--text-main)', outline: 'none' }} />
              <button onClick={() => sendAiQuestion(aiInput)} disabled={aiLoading || !aiInput.trim()} style={{ width: '40px', height: '40px', borderRadius: '10px', border: 'none', background: aiLoading || !aiInput.trim() ? '#94a3b8' : '#2563eb', cursor: aiLoading || !aiInput.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {aiLoading ? <Loader2 size={18} className="crm-spin" color="#fff" /> : <Send size={18} color="#fff" />}
              </button>
            </div>
          </>
        )}

        {/* AI disabled message */}
        {mode === 'ai' && !showAi && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center', background: 'var(--bg-light, #f8fafc)' }}>
            <Bot size={40} style={{ color: 'var(--text-muted)', opacity: 0.3, marginBottom: 12 }} />
            <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 4px' }}>AI Assistant is not configured</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>An admin needs to enable Jarvis AI in Settings before it can be used.</p>
          </div>
        )}
        </div>
      )}
    </>
  );
}
