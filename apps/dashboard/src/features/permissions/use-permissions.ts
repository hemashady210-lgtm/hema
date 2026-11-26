import { can, canLeave, canManageMember, type Capability, type MemberRef } from '@ai-crm/shared';
import { useAuth } from '@/app/auth';
import { useWorkspace } from '@/features/workspaces/context';

/**
 * Role-based UI (hide or disable actions). The database is the real enforcement: RLS, column
 * grants and the service-role RPCs behind the `api` function reject anything this allows wrongly.
 */
export function usePermissions() {
  const { role, workspace } = useWorkspace();
  const { user } = useAuth();
  const me: MemberRef | null = user ? { userId: user.id, role } : null;
  const writable = workspace.status === 'active';
  return {
    role,
    writable,
    can: (capability: Capability) => can(role, capability),
    /** Capability + workspace writable (trial ended / suspended → read-only). */
    canWrite: (capability: Capability) => writable && can(role, capability),
    canManage: (target: MemberRef) => writable && canManageMember(me, target),
    canLeave: () => canLeave(me),
  };
}
