import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export interface Workspace {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

interface WorkspaceContextValue {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  activeWorkspaceId: string | null;
  loading: boolean;
  switchWorkspace: (id: string) => void;
  createWorkspace: (name: string, description?: string) => Promise<Workspace | null>;
  renameWorkspace: (id: string, name: string) => Promise<boolean>;
  deleteWorkspace: (id: string) => Promise<boolean>;
  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const STORAGE_KEY_PREFIX = 'crm-active-workspace-';

export function WorkspaceProvider({ session, children }: { session: Session; children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshWorkspaces = useCallback(async () => {
    const { data, error } = await supabase
      .from('workspaces')
      .select('id, name, description, created_at')
      .order('created_at', { ascending: true });
    if (error || !data) return;
    const list = data as Workspace[];
    setWorkspaces(list);

    if (list.length === 0) return;

    const savedId = (() => {
      try { return localStorage.getItem(STORAGE_KEY_PREFIX + session.user.id); } catch { return null; }
    })();
    const valid = savedId && list.some((w) => w.id === savedId);
    const targetId = valid ? savedId! : list[0].id;
    setActiveWorkspaceId(targetId);
    try { localStorage.setItem(STORAGE_KEY_PREFIX + session.user.id, targetId); } catch { /* ignore */ }
  }, [session.user.id]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await supabase.rpc('ensure_default_workspace', { p_user_id: session.user.id });
      await refreshWorkspaces();
      setLoading(false);
    })();
  }, [session.user.id, refreshWorkspaces]);

  const switchWorkspace = useCallback((id: string) => {
    setActiveWorkspaceId(id);
    try { localStorage.setItem(STORAGE_KEY_PREFIX + session.user.id, id); } catch { /* ignore */ }
  }, [session.user.id]);

  const createWorkspace = useCallback(async (name: string, description?: string): Promise<Workspace | null> => {
    const { data, error } = await supabase
      .from('workspaces')
      .insert({ owner_id: session.user.id, name, description: description || '' })
      .select('id, name, description, created_at')
      .single();
    if (error || !data) return null;
    const ws = data as Workspace;
    setWorkspaces((prev) => [...prev, ws]);
    switchWorkspace(ws.id);
    return ws;
  }, [session.user.id, switchWorkspace]);

  const renameWorkspace = useCallback(async (id: string, name: string): Promise<boolean> => {
    const { error } = await supabase
      .from('workspaces')
      .update({ name })
      .eq('id', id);
    if (error) return false;
    setWorkspaces((prev) => prev.map((w) => w.id === id ? { ...w, name } : w));
    return true;
  }, []);

  const deleteWorkspace = useCallback(async (id: string): Promise<boolean> => {
    if (workspaces.length <= 1) return false;
    const { error } = await supabase
      .from('workspaces')
      .delete()
      .eq('id', id);
    if (error) return false;
    const remaining = workspaces.filter((w) => w.id !== id);
    setWorkspaces(remaining);
    if (activeWorkspaceId === id && remaining.length > 0) {
      switchWorkspace(remaining[0].id);
    }
    return true;
  }, [workspaces, activeWorkspaceId, switchWorkspace]);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;

  return (
    <WorkspaceContext.Provider value={{
      workspaces,
      activeWorkspace,
      activeWorkspaceId,
      loading,
      switchWorkspace,
      createWorkspace,
      renameWorkspace,
      deleteWorkspace,
      refreshWorkspaces,
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
