import { useState, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft, Plus, Users, Loader2, Trash2, RefreshCw, Link2, Copy,
  CheckCircle2, AlertTriangle, MessageCircle, Send, ExternalLink, X,
  Search, Info,
} from 'lucide-react';
import WhatsAppSetupGuide from './WhatsAppSetupGuide';

interface WaGroup {
  id: string;
  wa_group_id: string | null;
  subject: string;
  description: string | null;
  invite_link: string | null;
  join_approval_mode: string;
  participant_count: number;
  status: string;
  group_photo_url: string | null;
  meta_created_at: string | null;
  created_at: string;
}

interface GroupMessage {
  id: string;
  sender: 'admin' | 'client';
  sender_wa_id: string | null;
  sender_name: string | null;
  message_type: string;
  text_content: string | null;
  wa_message_id: string | null;
  delivery_status: string | null;
  created_at: string;
}

interface Props {
  session: Session;
  onBack: () => void;
}

export default function WhatsAppGroups({ session, onBack }: Props) {
  const [groups, setGroups] = useState<WaGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupApproval, setNewGroupApproval] = useState('auto_approve');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<WaGroup | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('wa_groups')
      .select('*')
      .neq('status', 'deleted')
      .order('created_at', { ascending: false });
    if (err) {
      setError(err.message);
    } else {
      setGroups(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // Realtime subscription for group updates
  useEffect(() => {
    const channel = supabase
      .channel('wa-groups-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wa_groups' }, () => {
        fetchGroups();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchGroups]);

  // Realtime for messages when a group is selected
  useEffect(() => {
    if (!selectedGroup) return;
    const channel = supabase
      .channel(`wa-group-msgs-${selectedGroup.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'wa_group_messages',
        filter: `group_id=eq.${selectedGroup.id}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as GroupMessage]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedGroup]);

  const fetchMessages = async (groupId: string) => {
    setMessagesLoading(true);
    const { data } = await supabase
      .from('wa_group_messages')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true });
    setMessages(data || []);
    setMessagesLoading(false);
  };

  const openGroup = (group: WaGroup) => {
    setSelectedGroup(group);
    fetchMessages(group.id);
  };

  const callGroupApi = async (action: string, body: Record<string, unknown>) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error('Not authenticated');

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-groups?action=${action}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      },
    );
    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
  };

  const handleCreate = async () => {
    if (!newGroupName.trim()) {
      setCreateError('Group name is required');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      await callGroupApi('create', {
        subject: newGroupName.trim(),
        description: newGroupDesc.trim() || undefined,
        joinApprovalMode: newGroupApproval,
      });
      setShowCreateModal(false);
      setNewGroupName('');
      setNewGroupDesc('');
      setNewGroupApproval('auto_approve');
      await fetchGroups();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (group: WaGroup) => {
    if (!confirm(`Delete "${group.subject}"? This will remove the group from WhatsApp.`)) return;
    setActionLoading(`delete-${group.id}`);
    try {
      await callGroupApi('delete', { groupId: group.wa_group_id });
      await fetchGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete group');
    } finally {
      setActionLoading(null);
    }
  };

  const handleGetInviteLink = async (group: WaGroup) => {
    setActionLoading(`invite-${group.id}`);
    try {
      const data = await callGroupApi('invite_link', { groupId: group.wa_group_id });
      await fetchGroups();
      // Copy to clipboard
      try {
        await navigator.clipboard.writeText(data.invite_link);
        setCopiedLinkId(group.id);
        setTimeout(() => setCopiedLinkId(null), 2000);
      } catch { /* clipboard may not be available */ }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get invite link');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSyncInfo = async (group: WaGroup) => {
    setActionLoading(`info-${group.id}`);
    try {
      await callGroupApi('info', { groupId: group.wa_group_id });
      await fetchGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync group info');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSyncAll = async () => {
    setActionLoading('sync-all');
    setError('');
    try {
      await callGroupApi('sync', {});
      await fetchGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync groups');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedGroup || !messageText.trim()) return;
    setSendingMessage(true);
    try {
      await callGroupApi('send_message', {
        groupId: selectedGroup.wa_group_id,
        text: messageText.trim(),
      });
      setMessageText('');
      await fetchMessages(selectedGroup.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLinkId(id);
      setTimeout(() => setCopiedLinkId(null), 2000);
    } catch { /* clipboard may not be available */ }
  };

  const filteredGroups = groups.filter((g) =>
    g.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (d: string | null) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (d: string) => {
    return new Date(d).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  // ─── Group Detail View (messages) ─────────────────────────────
  if (selectedGroup) {
    return (
      <div className="dash-overview">
        <div className="dash-page-header">
          <button className="dash-back-btn" onClick={() => setSelectedGroup(null)}>
            <ArrowLeft size={18} /> Back to Groups
          </button>
          <h1>{selectedGroup.subject}</h1>
          <p>{selectedGroup.participant_count} participants</p>
        </div>

        {error && (
          <div className="crm-error-banner" style={{ marginBottom: '16px' }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: '16px', height: 'calc(100vh - 220px)', minHeight: '400px' }}>
          {/* Messages area */}
          <div style={{
            flex: 1, background: 'var(--bg-card)', borderRadius: '12px',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            border: '1px solid var(--border-light)',
          }}>
            <div style={{
              padding: '14px 20px', borderBottom: '1px solid var(--border-light)',
              display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              <MessageCircle size={20} style={{ color: '#25D366' }} />
              <strong>Group Chat</strong>
              <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {messages.length} messages
              </span>
            </div>

            <div style={{
              flex: 1, overflowY: 'auto', padding: '16px 20px',
              display: 'flex', flexDirection: 'column', gap: '10px',
            }}>
              {messagesLoading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <Loader2 size={28} className="crm-spin" style={{ color: 'var(--text-muted)' }} />
                </div>
              ) : messages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  <MessageCircle size={40} style={{ opacity: 0.3, marginBottom: '8px' }} />
                  <p>No messages yet. Send the first message to the group.</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      flexDirection: msg.sender === 'admin' ? 'row-reverse' : 'row',
                      gap: '8px',
                    }}
                  >
                    <div style={{
                      maxWidth: '70%',
                      background: msg.sender === 'admin' ? '#25D366' : 'var(--bg-secondary)',
                      color: msg.sender === 'admin' ? '#fff' : 'var(--text-primary)',
                      borderRadius: msg.sender === 'admin' ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                      padding: '10px 14px',
                    }}>
                      {msg.sender === 'client' && (
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '2px', color: '#25D366' }}>
                          {msg.sender_name || msg.sender_wa_id || 'Unknown'}
                        </div>
                      )}
                      <div style={{ fontSize: '0.875rem', lineHeight: 1.4 }}>
                        {msg.text_content || `[${msg.message_type}]`}
                      </div>
                      <div style={{
                        fontSize: '0.7rem', marginTop: '4px', opacity: 0.7,
                        textAlign: msg.sender === 'admin' ? 'right' : 'left',
                      }}>
                        {formatTime(msg.created_at)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Send message bar */}
            <div style={{
              padding: '12px 16px', borderTop: '1px solid var(--border-light)',
              display: 'flex', gap: '8px',
            }}>
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type a message to the group..."
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: '8px',
                  border: '1px solid var(--border-light)', background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none',
                }}
              />
              <button
                onClick={handleSendMessage}
                disabled={sendingMessage || !messageText.trim()}
                style={{
                  padding: '10px 16px', borderRadius: '8px', border: 'none',
                  background: '#25D366', color: '#fff', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px',
                  fontSize: '0.875rem', fontWeight: 600, opacity: sendingMessage || !messageText.trim() ? 0.5 : 1,
                }}
              >
                {sendingMessage ? <Loader2 size={16} className="crm-spin" /> : <Send size={16} />}
                Send
              </button>
            </div>
          </div>

          {/* Group info sidebar */}
          <div style={{
            width: '280px', background: 'var(--bg-card)', borderRadius: '12px',
            padding: '20px', border: '1px solid var(--border-light)',
            display: 'flex', flexDirection: 'column', gap: '16px',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%', margin: '0 auto 12px',
                background: 'rgba(37,211,102,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Users size={28} style={{ color: '#25D366' }} />
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '4px' }}>{selectedGroup.subject}</h3>
              <span style={{
                fontSize: '0.75rem', padding: '3px 10px', borderRadius: '20px',
                background: selectedGroup.status === 'active' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                color: selectedGroup.status === 'active' ? '#16a34a' : '#dc2626',
                textTransform: 'capitalize',
              }}>
                {selectedGroup.status}
              </span>
            </div>

            {selectedGroup.description && (
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Description
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{selectedGroup.description}</p>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Participants</span>
              <strong>{selectedGroup.participant_count}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Join Mode</span>
              <strong style={{ textTransform: 'capitalize' }}>{selectedGroup.join_approval_mode.replace('_', ' ')}</strong>
            </div>

            {selectedGroup.meta_created_at && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Created on WhatsApp</span>
                <strong>{formatDate(selectedGroup.meta_created_at)}</strong>
              </div>
            )}

            {selectedGroup.invite_link && (
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Invite Link
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 10px', borderRadius: '8px',
                  background: 'var(--bg-secondary)', border: '1px solid var(--border-light)',
                }}>
                  <Link2 size={14} style={{ color: '#25D366', flexShrink: 0 }} />
                  <a
                    href={selectedGroup.invite_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}
                  >
                    {selectedGroup.invite_link}
                  </a>
                  <button
                    onClick={() => copyToClipboard(selectedGroup.invite_link!, selectedGroup.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--text-muted)' }}
                  >
                    {copiedLinkId === selectedGroup.id ? <CheckCircle2 size={14} style={{ color: '#16a34a' }} /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto' }}>
              <button
                onClick={() => handleGetInviteLink(selectedGroup)}
                disabled={actionLoading === `invite-${selectedGroup.id}`}
                style={{
                  padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-light)',
                  background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 500,
                }}
              >
                {actionLoading === `invite-${selectedGroup.id}` ? <Loader2 size={14} className="crm-spin" /> : <Link2 size={14} />}
                Get Invite Link
              </button>
              <button
                onClick={() => handleSyncInfo(selectedGroup)}
                disabled={actionLoading === `info-${selectedGroup.id}`}
                style={{
                  padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-light)',
                  background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 500,
                }}
              >
                {actionLoading === `info-${selectedGroup.id}` ? <Loader2 size={14} className="crm-spin" /> : <RefreshCw size={14} />}
                Sync Info
              </button>
              <button
                onClick={() => handleDelete(selectedGroup)}
                disabled={actionLoading === `delete-${selectedGroup.id}`}
                style={{
                  padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)',
                  background: 'rgba(239,68,68,0.08)', color: '#dc2626', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 500,
                }}
              >
                {actionLoading === `delete-${selectedGroup.id}` ? <Loader2 size={14} className="crm-spin" /> : <Trash2 size={14} />}
                Delete Group
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Groups List View ─────────────────────────────────────────
  return (
    <div className="dash-overview">
      <div className="dash-page-header">
        <button className="dash-back-btn" onClick={onBack}>
          <ArrowLeft size={18} /> Back
        </button>
        <h1>WhatsApp Groups</h1>
        <p>Create and manage WhatsApp groups through the Cloud API</p>
      </div>

      {error && (
        <div className="crm-error-banner" style={{ marginBottom: '16px' }}>{error}</div>
      )}

      <WhatsAppSetupGuide feature="groups" />

      {/* Toolbar */}
      <div style={{
        display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px',
        flexWrap: 'wrap',
      }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search groups..."
            style={{
              width: '100%', padding: '10px 12px 10px 38px', borderRadius: '8px',
              border: '1px solid var(--border-light)', background: 'var(--bg-card)',
              color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none',
            }}
          />
        </div>
        <button
          onClick={handleSyncAll}
          disabled={actionLoading === 'sync-all'}
          className="crm-btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
        >
          {actionLoading === 'sync-all' ? <Loader2 size={16} className="crm-spin" /> : <RefreshCw size={16} />}
          Sync from WhatsApp
        </button>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            padding: '10px 18px', borderRadius: '8px', border: 'none',
            background: '#25D366', color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '8px',
            fontSize: '0.875rem', fontWeight: 600, whiteSpace: 'nowrap',
          }}
        >
          <Plus size={16} /> Create Group
        </button>
      </div>

      {/* Groups grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <Loader2 size={32} className="crm-spin" style={{ color: 'var(--text-muted)' }} />
          <p style={{ marginTop: '12px', color: 'var(--text-muted)' }}>Loading groups...</p>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="crm-empty-state">
          <Users size={48} />
          <h3>No groups yet</h3>
          <p>Create your first WhatsApp group to start engaging with your audience in a community setting.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              marginTop: '16px', padding: '10px 20px', borderRadius: '8px', border: 'none',
              background: '#25D366', color: '#fff', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              fontSize: '0.875rem', fontWeight: 600,
            }}
          >
            <Plus size={16} /> Create Group
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '16px',
        }}>
          {filteredGroups.map((group) => (
            <div
              key={group.id}
              onClick={() => openGroup(group)}
              style={{
                background: 'var(--bg-card)', borderRadius: '12px', padding: '20px',
                border: '1px solid var(--border-light)', cursor: 'pointer',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(37,211,102,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Users size={20} style={{ color: '#25D366' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{
                    fontSize: '0.95rem', fontWeight: 700, marginBottom: '2px',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{group.subject}</h3>
                  <span style={{
                    fontSize: '0.7rem', padding: '2px 8px', borderRadius: '20px',
                    background: group.status === 'active' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                    color: group.status === 'active' ? '#16a34a' : '#dc2626',
                    textTransform: 'capitalize',
                  }}>
                    {group.status}
                  </span>
                </div>
              </div>

              {group.description && (
                <p style={{
                  fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px',
                  overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
                  WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                }}>
                  {group.description}
                </p>
              )}

              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px',
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Users size={13} /> {group.participant_count} members
                </span>
                <span>{formatDate(group.meta_created_at || group.created_at)}</span>
              </div>

              <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
                {group.invite_link ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); copyToClipboard(group.invite_link!, group.id); }}
                    style={{
                      flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-light)',
                      background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                      fontSize: '0.75rem', fontWeight: 500,
                    }}
                  >
                    {copiedLinkId === group.id ? <CheckCircle2 size={13} style={{ color: '#16a34a' }} /> : <Copy size={13} />}
                    {copiedLinkId === group.id ? 'Copied!' : 'Copy Link'}
                  </button>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleGetInviteLink(group); }}
                    disabled={actionLoading === `invite-${group.id}`}
                    style={{
                      flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-light)',
                      background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                      fontSize: '0.75rem', fontWeight: 500,
                    }}
                  >
                    {actionLoading === `invite-${group.id}` ? <Loader2 size={13} className="crm-spin" /> : <Link2 size={13} />}
                    Get Link
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); handleSyncInfo(group); }}
                  disabled={actionLoading === `info-${group.id}`}
                  style={{
                    padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-light)',
                    background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  title="Sync info"
                >
                  {actionLoading === `info-${group.id}` ? <Loader2 size={13} className="crm-spin" /> : <RefreshCw size={13} />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(group); }}
                  disabled={actionLoading === `delete-${group.id}`}
                  style={{
                    padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)',
                    background: 'rgba(239,68,68,0.08)', color: '#dc2626', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  title="Delete group"
                >
                  {actionLoading === `delete-${group.id}` ? <Loader2 size={13} className="crm-spin" /> : <Trash2 size={13} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            style={{
              background: 'var(--bg-card)', borderRadius: '16px', padding: '28px',
              maxWidth: '480px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Create WhatsApp Group</h2>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            {createError && (
              <div style={{
                padding: '10px 14px', borderRadius: '8px', marginBottom: '16px',
                background: 'rgba(239,68,68,0.1)', color: '#dc2626', fontSize: '0.85rem',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <AlertTriangle size={16} /> {createError}
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                Group Name <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="e.g. Trading Community VIP"
                maxLength={100}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '8px',
                  border: '1px solid var(--border-light)', background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none',
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                Description (optional)
              </label>
              <textarea
                value={newGroupDesc}
                onChange={(e) => setNewGroupDesc(e.target.value)}
                placeholder="What is this group about?"
                rows={3}
                maxLength={500}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '8px',
                  border: '1px solid var(--border-light)', background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none', resize: 'vertical',
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                Join Approval Mode
              </label>
              <select
                value={newGroupApproval}
                onChange={(e) => setNewGroupApproval(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '8px',
                  border: '1px solid var(--border-light)', background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none',
                }}
              >
                <option value="auto_approve">Auto Approve (members join instantly via link)</option>
                <option value="admin_approval">Admin Approval (you approve each join request)</option>
              </select>
            </div>

            <div style={{
              padding: '12px 14px', borderRadius: '8px', marginBottom: '20px',
              background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.2)',
              fontSize: '0.8rem', color: 'var(--text-secondary)',
              display: 'flex', gap: '8px', alignItems: 'flex-start',
            }}>
              <Info size={16} style={{ color: '#25D366', flexShrink: 0, marginTop: '1px' }} />
              <span>
                After creating the group, you'll get an invite link that you can share.
                People can join the group using that link.
              </span>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border-light)',
                  background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer',
                  fontSize: '0.875rem', fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newGroupName.trim()}
                style={{
                  padding: '10px 20px', borderRadius: '8px', border: 'none',
                  background: '#25D366', color: '#fff', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '8px',
                  fontSize: '0.875rem', fontWeight: 600, opacity: creating || !newGroupName.trim() ? 0.5 : 1,
                }}
              >
                {creating ? <Loader2 size={16} className="crm-spin" /> : <Plus size={16} />}
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
