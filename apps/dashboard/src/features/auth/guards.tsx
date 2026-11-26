import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '@/app/auth';
import { FullPageLoader } from '@/components/full-page-loader';
import { useNextPath } from './shared';

/** Protected routes: no session → sign-in with ?next= back to the requested page. */
export function RequireAuth({ children }: { children?: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageLoader />;
  if (!session) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/auth/sign-in?next=${encodeURIComponent(next)}`} replace />;
  }
  return children ?? <Outlet />;
}

/** Sign-in / sign-up / forgot: a signed-in visitor continues where they were going. */
export function RedirectIfAuthenticated({ children }: { children?: ReactNode }) {
  const { session, loading } = useAuth();
  const next = useNextPath();
  if (loading) return <FullPageLoader />;
  if (session) return <Navigate to={next} replace />;
  return children ?? <Outlet />;
}
