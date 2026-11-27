/**
 * Workspace roles and UI capabilities (decision C2, ARCHITECTURE.md §3).
 * The UI uses these to hide/disable actions; the database (RLS + service-role RPCs) is the
 * real enforcement and must stay in line with this table.
 */
export const WORKSPACE_ROLES = ['owner', 'admin', 'agent', 'viewer'] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

/** Roles an invitation can grant. Ownership changes only by transfer (P3 decision 3). */
export const INVITABLE_ROLES = ['admin', 'agent', 'viewer'] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

const ALL: readonly WorkspaceRole[] = WORKSPACE_ROLES;
const OWNER_ADMIN: readonly WorkspaceRole[] = ['owner', 'admin'];
const AGENT_UP: readonly WorkspaceRole[] = ['owner', 'admin', 'agent'];
const OWNER: readonly WorkspaceRole[] = ['owner'];

export const CAPABILITIES = {
  'workspace.view': ALL,
  'workspace.settings.edit': OWNER_ADMIN,
  'workspace.transfer': OWNER,
  'workspace.delete': OWNER,
  'members.view': ALL,
  'members.invite': OWNER_ADMIN,
  'members.manage': OWNER_ADMIN,
  'billing.view': OWNER_ADMIN,
  'billing.manage': OWNER,
  'inbox.reply': AGENT_UP,
  'customers.edit': AGENT_UP,
  'orders.manage': AGENT_UP,
  'bots.manage': OWNER_ADMIN,
  'knowledge.manage': OWNER_ADMIN,
  'channels.request': OWNER_ADMIN,
  'api_keys.manage': OWNER_ADMIN,
  'data.export': OWNER,
} as const satisfies Record<string, readonly WorkspaceRole[]>;

export type Capability = keyof typeof CAPABILITIES;

export function can(role: WorkspaceRole | null | undefined, capability: Capability): boolean {
  if (!role) return false;
  return (CAPABILITIES[capability] as readonly WorkspaceRole[]).includes(role);
}

export interface MemberRef {
  userId: string;
  role: WorkspaceRole;
}

/**
 * Whether `actor` may change the role of / remove `target` (mirrors public.change_member_role
 * and public.remove_member): owner/admin only, never the owner, never yourself.
 */
export function canManageMember(actor: MemberRef | null | undefined, target: MemberRef): boolean {
  if (!actor || !can(actor.role, 'members.manage')) return false;
  if (target.role === 'owner') return false;
  return actor.userId !== target.userId;
}

/** A member may leave unless they own the workspace (transfer ownership first). */
export function canLeave(member: MemberRef | null | undefined): boolean {
  return !!member && member.role !== 'owner';
}
