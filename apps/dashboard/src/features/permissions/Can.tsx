import type { ReactNode } from 'react';
import type { Capability } from '@ai-crm/shared';
import { usePermissions } from './use-permissions';

/** Renders children only when the current member has the capability (UI hint, not security). */
export function Can({
  capability,
  children,
  fallback = null,
}: {
  capability: Capability;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { can } = usePermissions();
  return <>{can(capability) ? children : fallback}</>;
}
