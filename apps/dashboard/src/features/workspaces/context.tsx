import { createContext, useContext } from 'react';
import type { WorkspaceRole } from '@ai-crm/shared';
import type { Membership, Workspace } from './queries';

export interface WorkspaceContextValue {
  workspace: Workspace;
  role: WorkspaceRole;
  memberships: Membership[];
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used inside a workspace route');
  return ctx;
}
