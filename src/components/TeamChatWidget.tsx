import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { MessageSquare, X, Send, Users, Circle } from 'lucide-react';

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

interface TeamChatWidgetProps {
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

export default function TeamChatWidget({ session, userRole }: TeamChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<TeamChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [teamOwnerId, setTeamOwnerId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>('');
  const [teamMembers, setTeamMembers] = useState<TeamMemberInfo[]>([]);
  const [showMembersList, setShowMembersList] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const resolveTeamOwner = useCallback(async (): Promise<string | null> => {
    if (userRole === 'owner') return session.user.id;

    const { data } = await supabase
      .from('team_members')
      .select('owner_id')
      .eq('email', session.user.email || '')
      .maybeSingle();
    return (data as { owner_id: string } | null)?.owner_id || null;
  }, [userRole, session.user.id, session.user.email]);

  useEffect(() => {
    (async () => {
      const ownerId = await resolveTeamOwner();
      if (!ownerId) return;
      setTeamOwnerId(ownerId);

      // Fetch chat messages
      const { data: msgData, error } = await supabase
        .from('team_chat_messages')
        .select('*')
        .eq('team_owner_id', ownerId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (!error && msgData) {
        setMessages(msgData as TeamChatMessage[]);
      }
      setLoading(false);

      // Fetch team members to resolve display names
      const { data: membersData } = await supabase
        .from('team_members')
        .select('id, email, full_name, role, status')
        .eq('owner_id', ownerId);

      const members = (membersData || []) as TeamMemberInfo[];
      setTeamMembers(members);

      // Resolve current user's display name from team_members
      const currentUserMember = members.find((m) => m.email === session.user.email);
      if (currentUserMember && currentUserMember.full_name) {
        setDisplayName(currentUserMember.full_name);
      } else if (userRole === 'owner') {
        // Owner might not be in team_members — try user metadata, then email prefix
        const metaName = session.user.user_metadata?.full_name || session.user.user_metadata?.name;
        setDisplayName(metaName || session.user.email?.split('@')[0] || 'Owner');
      } else {
        setDisplayName(session.user.email?.split('@')[0] || 'Team Member');
      }
    })();
  }, [resolveTeamOwner, session.user.email, session.user.user_metadata, userRole]);

  useEffect(() => {
    if (!teamOwnerId) return;

    const channel = supabase
      .channel('team-chat-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'team_chat_messages',
          filter: `team_owner_id=eq.${teamOwnerId}`,
        },
        (payload) => {
          const newMsg = payload.new as TeamChatMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });

          if (newMsg.sender_id !== session.user.id && !isOpen) {
            setUnreadCount((c) => c + 1);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'team_chat_messages',
          filter: `team_owner_id=eq.${teamOwnerId}`,
        },
        (payload) => {
          const deletedId = (payload.old as TeamChatMessage).id;
          setMessages((prev) => prev.filter((m) => m.id !== deletedId));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamOwnerId, isOpen, session.user.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
    }
  }, [isOpen]);

  const handleSend = async () => {
    const text = newMessage.trim();
    if (!text || !teamOwnerId || sending) return;

    setSending(true);
    setNewMessage('');

    const role = userRole === 'owner' ? 'owner' : userRole;

    const { error } = await supabase.from('team_chat_messages').insert({
      team_owner_id: teamOwnerId,
      sender_id: session.user.id,
      sender_name: displayName,
      sender_role: role,
      message_text: text,
    });

    if (error) {
      setNewMessage(text);
    } else {
      try {
        const token = (await supabase.auth.getSession()).session?.access_token;
        if (token) {
          await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-chat-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ sender_id: session.user.id, sender_name: displayName, message_text: text, team_owner_id: teamOwnerId }),
          });
        }
      } catch {
        // Non-fatal — notification is best-effort
      }
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const isOwnMessage = (msg: TeamChatMessage) => msg.sender_id === session.user.id;

  // Build a map of email -> full_name from team members for resolving sender names
  const memberNameMap: Record<string, string> = {};
  teamMembers.forEach((m) => {
    memberNameMap[m.email] = m.full_name || m.email.split('@')[0];
  });

  // Resolve sender display name: check team_members by matching sender_name (which was the email at send time)
  // or just use the stored sender_name as-is (it was set at send time from team_members)
  const resolveSenderName = (msg: TeamChatMessage): string => {
    // sender_name was stored at send time — if it's an email prefix, try to resolve to full_name
    const memberByEmail = teamMembers.find((m) => m.email === msg.sender_name || m.email.split('@')[0] === msg.sender_name);
    if (memberByEmail && memberByEmail.full_name) return memberByEmail.full_name;
    return msg.sender_name;
  };

  const activeMembers = teamMembers.filter((m) => m.status === 'active');

  return (
    <>
      {/* Floating Button */}
      <button
        className="team-chat-fab"
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Team chat"
      >
        <MessageSquare size={24} />
        {unreadCount > 0 && <span className="team-chat-fab-badge">{unreadCount}</span>}
        <span className="team-chat-fab-pulse" />
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="team-chat-panel">
          <div className="team-chat-header">
            <div className="team-chat-header-info">
              <div className="team-chat-header-icon">
                <MessageSquare size={18} />
              </div>
              <div>
                <h3>Team Chat</h3>
                <span className="team-chat-header-sub">{activeMembers.length + (userRole === 'owner' ? 1 : 0)} members in team</span>
              </div>
            </div>
            <div className="team-chat-header-actions">
              <button
                className="team-chat-members-btn"
                onClick={() => setShowMembersList((v) => !v)}
                aria-label="Team members"
                title="Team members"
              >
                <Users size={18} />
              </button>
              <button className="team-chat-close" onClick={() => setIsOpen(false)} aria-label="Close chat">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Members List Dropdown */}
          {showMembersList && (
            <div className="team-chat-members-list">
              <div className="team-chat-members-header">
                <span>Team Members</span>
                <button onClick={() => setShowMembersList(false)} aria-label="Close members">
                  <X size={14} />
                </button>
              </div>
              <div className="team-chat-members-body">
                {/* Owner */}
                <div className="team-chat-member-item">
                  <div className="team-chat-member-avatar" style={{ background: `${ROLE_COLORS.owner}22`, color: ROLE_COLORS.owner }}>
                    {(session.user.email?.charAt(0) || 'O').toUpperCase()}
                  </div>
                  <div className="team-chat-member-info">
                    <span className="team-chat-member-name">
                      {userRole === 'owner' ? (displayName || 'You') : 'Owner'}
                    </span>
                    <span className="team-chat-member-email">{session.user.email}</span>
                  </div>
                  <span className="team-chat-member-role" style={{ background: `${ROLE_COLORS.owner}15`, color: ROLE_COLORS.owner }}>
                    Owner
                  </span>
                </div>
                {/* Team Members */}
                {teamMembers.map((m) => (
                  <div key={m.id} className="team-chat-member-item">
                    <div className="team-chat-member-avatar" style={{ background: `${ROLE_COLORS[m.role] || ROLE_COLORS.agent}22`, color: ROLE_COLORS[m.role] || ROLE_COLORS.agent }}>
                      {(m.full_name || m.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="team-chat-member-info">
                      <span className="team-chat-member-name">{m.full_name || m.email.split('@')[0]}</span>
                      <span className="team-chat-member-email">{m.email}</span>
                    </div>
                    <span className="team-chat-member-role" style={{ background: `${ROLE_COLORS[m.role] || ROLE_COLORS.agent}15`, color: ROLE_COLORS[m.role] || ROLE_COLORS.agent }}>
                      {ROLE_LABELS[m.role] || m.role}
                    </span>
                    {m.status === 'active' ? (
                      <Circle size={8} className="team-chat-member-status team-chat-member-active" fill="#22C55E" />
                    ) : (
                      <Circle size={8} className="team-chat-member-status" fill="#94A3B8" />
                    )}
                  </div>
                ))}
                {teamMembers.length === 0 && (
                  <div className="team-chat-members-empty">
                    <Users size={28} style={{ opacity: 0.2, marginBottom: 8 }} />
                    <p>No team members added yet. Invite them from Settings → Team Management.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="team-chat-body" ref={scrollRef}>
            {loading ? (
              <div className="team-chat-empty">
                <div className="team-chat-loading-spinner" />
                <p>Loading messages...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="team-chat-empty">
                <MessageSquare size={36} style={{ opacity: 0.2, marginBottom: 10 }} />
                <p>No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map((msg, i) => {
                const own = isOwnMessage(msg);
                const prevMsg = messages[i - 1];
                const showAvatar = !prevMsg || prevMsg.sender_id !== msg.sender_id;
                const roleColor = ROLE_COLORS[msg.sender_role] || '#06B6D4';
                const senderName = own ? displayName : resolveSenderName(msg);
                return (
                  <div key={msg.id} className={`team-chat-msg ${own ? 'own' : ''} ${!showAvatar ? 'grouped' : ''}`}>
                    {!own && showAvatar && (
                      <div className="team-chat-avatar" style={{ background: `${roleColor}22`, color: roleColor }}>
                        {senderName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="team-chat-msg-content">
                      {showAvatar && (
                        <div className="team-chat-msg-meta">
                          <span className="team-chat-msg-name" style={{ color: own ? '#fff' : roleColor }}>
                            {own ? 'You' : senderName}
                          </span>
                          {!own && (
                            <span className="team-chat-msg-role" style={{ background: `${roleColor}15`, color: roleColor }}>
                              {ROLE_LABELS[msg.sender_role] || msg.sender_role}
                            </span>
                          )}
                          <span className="team-chat-msg-time">{formatTime(msg.created_at)}</span>
                        </div>
                      )}
                      <div className={`team-chat-msg-bubble ${own ? 'own' : ''}`}>
                        {msg.message_text}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="team-chat-input-area">
            <textarea
              className="team-chat-input"
              placeholder="Type a message to your team..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={sending}
            />
            <button
              className="team-chat-send-btn"
              onClick={handleSend}
              disabled={!newMessage.trim() || sending}
              aria-label="Send message"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
