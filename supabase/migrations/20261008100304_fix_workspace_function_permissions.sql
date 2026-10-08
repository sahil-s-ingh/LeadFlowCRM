-- Revoke anon execute on workspace helper functions (only authenticated needs them)
REVOKE EXECUTE ON FUNCTION public.ensure_default_workspace(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_workspace_ids() FROM anon;
